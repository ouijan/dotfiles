return {
	{
		"github/copilot.vim",
		-- opts = {},
	},
	{
		"olimorris/codecompanion.nvim",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-treesitter/nvim-treesitter",
		},
		keys = {
			{
				"<leader>ac",
				"<cmd>CodeCompanionChat Toggle<CR>",
				desc = "AI Chat",
			},
			{
				"<leader>aa",
				"<cmd>CodeCompanionActions<CR>",
				desc = "AI Actions",
			},
		},
		opts = {
			strategies = {
				chat = {
					adapter = "gemini_cli",
				},
			},
		},
	},
	{
		"MeanderingProgrammer/render-markdown.nvim",
		ft = { "markdown", "codecompanion" },
	},
}
