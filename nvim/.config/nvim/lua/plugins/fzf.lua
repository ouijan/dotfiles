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
		winopts = {
			border = "solid",
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
				prompt = "Git Diff> ",
				winopts = {
					preview = {
						hidden = true,
					},
				},
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
