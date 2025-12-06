return {
	{
		"sindrets/diffview.nvim",
		keys = {
			{
				"<leader>gd",
				"<cmd>DiffviewOpen<cr>",
				desc = "Open Diffview",
			},
			{
				"<leader>gh",
				"<cmd>DiffviewFileHistory %<cr>",
				desc = "Diffview File History",
			},
			{
				"<leader>gH",
				"<cmd>DiffviewFileHistory<cr>",
				desc = "Diffview Branch History",
			},
		},
		config = function()
			local actions = require("diffview.actions")
			require("diffview").setup({
				keymaps = {
					view = {
						{ "n", "q", actions.close, { desc = "Close help menu" } },
					},
					file_panel = {
						{ "n", "q", "<cmd>DiffviewClose<cr>", { desc = "Close help menu" } },
					},
					file_history_panel = {
						{ "n", "q", "<cmd>DiffviewClose<cr>", { desc = "Close help menu" } },
					},
				},
			})
		end,
	},
	{
		"NeogitOrg/neogit",
		lazy = true,
		dependencies = {
			"nvim-lua/plenary.nvim",
			"sindrets/diffview.nvim",
			"ibhagwan/fzf-lua",
		},
		cmd = "Neogit",
		keys = {
			{ "<leader>gg", "<cmd>Neogit<cr>", desc = "Show Neogit UI" },
		},
		config = function()
			require("neogit").setup({
				integrations = {
					diffview = true,
					fzf_lua = true,
				},
			})
		end,
	},
	{
		"lewis6991/gitsigns.nvim",
		keys = {
			-- Search
			{
				"<leader>gb",
				function()
					require("gitsigns").toggle_current_line_blame()
				end,
				desc = "Git Blame Current Line",
			},
		},
		config = function()
			require("gitsigns").setup({
				current_line_blame = true,
				numhl = true,
				signcolumn = false,
			})
		end,
	},
}
