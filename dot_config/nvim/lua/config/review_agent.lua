-- Hand tuicr review comments to a coding agent running in another herdr pane,
-- instead of yanking the review and pasting it by hand.
--
-- Targets are chosen by working directory: an agent whose cwd matches the repo
-- you are reviewing wins outright, otherwise you pick from a list.

local tuicr = require("config.tuicr")

local M = {}

-- Focus the agent's pane after handing over, so you can watch it start.
M.focus_after_send = true

local function herdr(args)
	local result = vim.system(vim.list_extend({ "herdr" }, args), { text = true }):wait()
	if result.code ~= 0 then
		vim.notify("herdr " .. table.concat(args, " ") .. ": " .. (result.stderr or ""), vim.log.levels.ERROR)
		return nil
	end
	return vim.json.decode(result.stdout)
end

local function live_agents()
	local response = herdr({ "agent", "list" })
	if response == nil then
		return {}
	end
	return response.result.agents or {}
end

local function agents_in(root)
	local matches = {}
	for _, agent in ipairs(live_agents()) do
		if agent.cwd == root then
			table.insert(matches, agent)
		end
	end
	return matches
end

local function describe(agent)
	local title = agent.terminal_title_stripped or agent.agent
	return string.format("%s  [%s]  %s", agent.agent, agent.agent_status, title)
end

---@param comment table
local function format_comment(comment, index)
	local heading = string.format("%d. %s", index, comment.location)
	local kind = comment.comment_type
	if kind and kind ~= "none" then
		heading = heading .. " (" .. kind .. ")"
	end
	if comment.side == "old" then
		heading = heading .. " (deleted side)"
	end
	return heading .. "\n" .. comment.content
end

local function build_prompt(comments, session)
	local parts = {
		string.format("Review comments from tuicr on %s:", session.slug),
		"",
	}
	for index, comment in ipairs(comments) do
		table.insert(parts, format_comment(comment, index))
		table.insert(parts, "")
	end
	table.insert(parts, "Work through each item. Ask before expanding scope beyond these comments.")
	return table.concat(parts, "\n")
end

local function deliver(agent, prompt)
	local sent = herdr({ "agent", "prompt", agent.pane_id, prompt })
	if sent == nil then
		return
	end
	vim.notify("Review sent to " .. describe(agent))
	if M.focus_after_send then
		herdr({ "agent", "focus", agent.pane_id })
	end
end

local function choose_then(candidates, callback)
	if #candidates == 1 then
		callback(candidates[1])
		return
	end
	vim.ui.select(candidates, { prompt = "Send review to:", format_item = describe }, function(choice)
		if choice ~= nil then
			callback(choice)
		end
	end)
end

---Send the current tuicr review's comments to an agent.
function M.send_review()
	if vim.env.HERDR_ENV ~= "1" then
		vim.notify("Not running inside herdr; no agent panes to target", vim.log.levels.WARN)
		return
	end

	local session = tuicr.session()
	if session == nil then
		vim.notify("No tuicr review session for this repo", vim.log.levels.WARN)
		return
	end

	local comments = tuicr.comments(session)
	if #comments == 0 then
		vim.notify("Review has no comments yet (save them in tuicr with :w)", vim.log.levels.WARN)
		return
	end

	local prompt = build_prompt(comments, session)
	local candidates = agents_in(tuicr.root())
	if #candidates == 0 then
		candidates = live_agents()
	end
	if #candidates == 0 then
		vim.notify("No live agents; start one with `herdr agent start`", vim.log.levels.WARN)
		return
	end

	choose_then(candidates, function(agent)
		deliver(agent, prompt)
	end)
end

return M
