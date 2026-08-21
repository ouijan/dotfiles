-- tuicr code review hosted inside an nvim terminal buffer, so review and editing
-- share one pane.
--
-- Round trip:
--   <leader>cr / <leader>cf  ->  tuicr opens in its own tab, jumped to the cursor line
--   e (inside tuicr)         ->  file opens in THIS nvim, tuicr stays alive in its tab
--   <leader>cr again         ->  back to tuicr, exactly where it was
--
-- Nesting is impossible by construction: tuicr's $EDITOR is a shim that talks to
-- this instance over $NVIM instead of starting a new one. See ~/.local/bin/tuicr-editor.

local M = {}

local PAINT_POLL_MS = 50
local PAINT_TIMEOUT_MS = 3000
local EDITOR_SHIM = vim.fn.expand("~/.local/bin/tuicr-editor")

-- Reload the tuicr diff on return so edits made via the shim show up.
M.reload_on_return = true

---@class TuicrState
---@field buf integer?
---@field chan integer?
---@field tab integer?
---@field path string?  file the session is scoped to, nil for whole working tree
---@field root string?
local state = {}

local function is_live()
	return state.chan ~= nil and state.buf ~= nil and vim.api.nvim_buf_is_valid(state.buf)
end

local function git_root()
	local marker = vim.fs.root(0, ".git")
	return marker or vim.uv.cwd()
end

local function relative_to_root(root)
	local absolute = vim.api.nvim_buf_get_name(0)
	if absolute == "" then
		return nil
	end
	return vim.fs.relpath(root, absolute)
end

local function has_painted()
	local lines = vim.api.nvim_buf_get_lines(state.buf, 0, -1, false)
	for _, text in ipairs(lines) do
		if text:match("%S") then
			return true
		end
	end
	return false
end

-- tuicr has no --line flag, so the only way to land on a line is to type its
-- jump command once the TUI is up.
local function send_when_painted(keys)
	local timer = vim.uv.new_timer()
	local waited = 0

	local function finish(timer_handle)
		timer_handle:stop()
		timer_handle:close()
	end

	timer:start(PAINT_POLL_MS, PAINT_POLL_MS, function()
		waited = waited + PAINT_POLL_MS
		local expired = waited >= PAINT_TIMEOUT_MS

		vim.schedule(function()
			if timer:is_closing() then
				return
			end
			if not is_live() or expired then
				finish(timer)
				return
			end
			if not has_painted() then
				return
			end
			finish(timer)
			vim.fn.chansend(state.chan, keys)
		end)
	end)
end

local function clear_state()
	local tab = state.tab
	state = {}
	if tab ~= nil and vim.api.nvim_tabpage_is_valid(tab) and #vim.api.nvim_list_tabpages() > 1 then
		vim.api.nvim_win_close(vim.api.nvim_tabpage_get_win(tab), true)
	end
	vim.cmd("checktime")
end

local function start(opts)
	local root = git_root()
	local command = { "tuicr", "-w", "--no-update-check" }
	if opts.path then
		vim.list_extend(command, { "-p", opts.path })
	end

	vim.cmd("tabnew")
	state.tab = vim.api.nvim_get_current_tabpage()
	state.buf = vim.api.nvim_get_current_buf()
	state.path = opts.path
	state.root = root
	state.chan = vim.fn.jobstart(command, {
		term = true,
		cwd = root,
		env = { EDITOR = EDITOR_SHIM, VISUAL = EDITOR_SHIM },
		on_exit = vim.schedule_wrap(clear_state),
	})

	vim.bo[state.buf].buflisted = false
	-- tuicr never binds Ctrl-G, so it is free for handing the review to an agent.
	vim.keymap.set("t", "<C-g>", function()
		M.send_to_agent()
	end, { buffer = state.buf, desc = "Send Review To Agent" })
	vim.cmd("startinsert")

	if opts.line then
		send_when_painted(":" .. opts.line .. "\r")
	end
end

local function focus(opts)
	vim.api.nvim_set_current_tabpage(state.tab)
	vim.cmd("startinsert")

	local keys = ""
	if M.reload_on_return then
		keys = keys .. ":e\r"
	end
	if opts.line and (opts.path == nil or opts.path == state.path) then
		keys = keys .. ":" .. opts.line .. "\r"
	end
	if keys ~= "" then
		vim.fn.chansend(state.chan, keys)
	end
end

local function restart_confirmed(scope)
	local answer = vim.fn.confirm("tuicr is reviewing " .. scope .. ". Restart scoped to this file?", "&Yes\n&No", 2)
	return answer == 1
end

---Open, or return to, a tuicr review.
---@param opts { path: string?, line: integer? }
function M.review(opts)
	opts = opts or {}

	if not is_live() then
		vim.cmd("write")
		start(opts)
		return
	end

	local rescope = opts.path ~= nil and opts.path ~= state.path
	if rescope and not restart_confirmed(state.path or "the whole working tree") then
		focus({ line = nil })
		return
	end

	if rescope then
		vim.cmd("write")
		vim.fn.chansend(state.chan, ":wq\r") -- persists draft comments before exit
		vim.wait(2000, function()
			return not is_live()
		end, 50)
		start(opts)
		return
	end

	vim.cmd("write")
	focus(opts)
end

---Review the whole working tree.
function M.review_tree()
	M.review({})
end

---Review the current file, landing on the cursor line.
function M.review_file()
	local root = git_root()
	local path = relative_to_root(root)
	if path == nil then
		vim.notify("tuicr: buffer has no file on disk", vim.log.levels.WARN)
		return
	end
	M.review({ path = path, line = vim.fn.line(".") })
end

---Repo the review is anchored to.
---@return string
function M.root()
	return state.root or git_root()
end

local function tuicr_json(args)
	local result = vim.system(vim.list_extend({ "tuicr", "review" }, args), { text = true, cwd = M.root() }):wait()
	if result.code ~= 0 then
		vim.notify("tuicr review: " .. (result.stderr or ""), vim.log.levels.ERROR)
		return nil
	end
	return vim.json.decode(result.stdout)
end

---Most relevant persisted review session for this repo: the live one if there is
---one, else the most recently touched.
---@return table?
function M.session()
	local sessions = tuicr_json({ "list", "--repo", M.root() })
	if sessions == nil or #sessions == 0 then
		return nil
	end

	local best = sessions[1]
	for _, session in ipairs(sessions) do
		local fresher = session.updated_at > best.updated_at
		if session.active or (fresher and not best.active) then
			best = session
		end
	end
	return best
end

---@param session table from M.session()
---@return table[]
function M.comments(session)
	return tuicr_json({ "comments", "--session", session.path }) or {}
end

---Persist draft comments, then hand the review to an agent.
function M.send_to_agent()
	if is_live() then
		vim.fn.chansend(state.chan, ":w\r") -- flush drafts to the session file
		vim.wait(300)
	end
	require("config.review_agent").send_review()
end

---Called by ~/.local/bin/tuicr-editor via --remote-expr when tuicr presses `e`.
---@param file string
---@param line integer
---@return integer
function _G.TuicrEdit(file, line)
	vim.schedule(function()
		local tuicr_tab = state.tab
		local tabs = vim.api.nvim_list_tabpages()
		for _, tab in ipairs(tabs) do
			if tab ~= tuicr_tab then
				vim.api.nvim_set_current_tabpage(tab)
				break
			end
		end

		vim.cmd.edit(vim.fn.fnameescape(file))
		local clamped = math.min(line, vim.api.nvim_buf_line_count(0))
		vim.api.nvim_win_set_cursor(0, { math.max(clamped, 1), 0 })
		vim.cmd("normal! zz")
	end)
	return 1
end

return M
