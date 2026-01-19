return {
	"ibhagwan/fzf-lua",
	dependencies = { "nvim-tree/nvim-web-devicons" },
	keys = {
		-- Common
		{
			"<leader><leader>",
			function()
				require("fzf-lua").global()
			end,
			desc = "Search Recent + Git",
		},
		-- Search
		{
			"<leader>sf",
			function()
				require("fzf-lua").files()
			end,
			desc = "Search Files",
		},
		{
			"<leader>sg",
			function()
				require("fzf-lua").live_grep()
			end,
			desc = "Search Grep",
		},
		{
			"<leader>sd",
			function()
				require("fzf-lua").git_diff()
			end,
			desc = "Search Git Diff",
		},
		{
			"<leader>sw",
			function()
				require("fzf-lua").git_worktrees()
			end,
			desc = "Search Git Worktrees",
		},
		{
			"<leader>sr",
			function()
				require("fzf-lua").resume()
			end,
			desc = "Search Resume",
		},
		-- {
		-- 	"<leader>sb",
		-- 	function()
		-- 		require("fzf-lua").buffers()
		-- 	end,
		-- 	desc = "Search open buffers",
		-- },
		-- Code Actions
		{
			"<leader>ca",
			function()
				require("fzf-lua").lsp_code_actions()
			end,
			desc = "Code Actions",
		},
		-- {
		-- 	"<leader>cs",
		-- 	function()
		-- 		require("fzf-lua").lsp_document_symbols()
		-- 	end,
		-- 	desc = "Code Symbols Document",
		-- },
		-- {
		-- 	"<leader>cS",
		-- 	function()
		-- 		require("fzf-lua").lsp_live_workspace_symbols()
		-- 	end,
		-- 	desc = "Code Symbols Workspace",
		-- },
		{
			"<leader>cd",
			function()
				require("fzf-lua").lsp_definitions()
			end,
			desc = "Go to Definition",
		},
		{
			"<leader>cD",
			function()
				require("fzf-lua").lsp_declarations()
			end,
			desc = "Go to Declaration",
		},
		{
			"<leader>cr",
			function()
				require("fzf-lua").lsp_references()
			end,
			desc = "Go to References",
		},

		-- Diagnostics
		{
			"<leader>dd",
			function()
				require("fzf-lua").diagnostics_document()
			end,
			desc = "Diagnostics for Document",
		},
		{
			"<leader>dw",
			function()
				require("fzf-lua").diagnostics_workspace()
			end,
			desc = "Diagnostics for Workspce",
		},

		-- Quickfix
		{
			"<leader>q",
			function()
				require("fzf-lua").quickfix()
			end,
			desc = "Quickfix List",
		},
	},
	opts = {
		"hide", -- fix for resume
		defaults = {
			-- 	formatter = "path.filename_first",
			winopts = {
				height = 1,
				width = 1,
			},
		},
		multiprocess = true,
		winopts = {
			border = "solid",
			winblend = true,
			preview = {
				border = "solid",
				scrollbar = "float",
			},
		},
		-- hls = {
		-- 	normal = "NormalFloat",
		-- 	border = "NormalFloat",
		-- 	preview_normal = "Normal",
		-- 	preview_border = "Normal",
		-- },
		keymap = {
			fzf = {
				["ctrl-q"] = "select-all+accept",
			},
		},
		files = {
			prompt = "Files> ",
		},
		grep = {
			prompt = "Grep> ",
		},
		git = {
			diff = {
				prompt = "Diff> ",
				winopts = {
					preview = {
						hidden = true,
					},
				},
			},
			worktrees = {
				prompt = "Worktrees> ",
				preview = false,
				actions = {
					["default"] = function(selected)
						if not selected or not selected[1] then
							return
						end
						-- Strip ANSI codes first, then extract path after "(bare) " or "[branch] "
						local clean = selected[1]:gsub("\27%[[%d;]*m", "")
						local path = clean:match("^%(.-%s(.+)$") or clean:match("^%[.-%]%s(.+)$")
						if path then
							-- Clear jumplist (like git-worktree.nvim does)
							vim.cmd("clearjumps")
							-- Change directory
							vim.cmd("cd " .. vim.fn.fnameescape(path))
							-- Open the root directory to force buffer refresh
							vim.cmd("edit .")
							-- Emit events to refresh statusline plugins
							vim.api.nvim_exec_autocmds("User", {
								pattern = "GitWorktreeChanged",
							})
							vim.api.nvim_exec_autocmds("BufEnter", {})
							vim.notify("Switched to worktree: " .. path)
						end
					end,
				},
				fn_transform = function(line)
					local path, rest = line:match("^(%S+)%s+(.+)$")
					if not path then
						return line
					end
					local branch = rest:match("%[(.-)%]") or rest:match("%((.-)%)") or ""
					-- Grey ANSI color for path
					local grey = "\27[90m"
					local reset = "\27[0m"
					if branch == "bare" then
						return "(bare) " .. grey .. path .. reset
					end
					return "[" .. branch .. "] " .. grey .. path .. reset
				end,
			},
		},
		code_actions = {
			prompt = "Code Actions> ",
			preview = false,
		},
	},
	config = function(_, opts)
		local fzf = require("fzf-lua")
		fzf.setup(opts)
		fzf.register_ui_select()
	end,
}
