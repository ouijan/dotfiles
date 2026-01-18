return {
	{
		"nvim-neo-tree/neo-tree.nvim",
		branch = "v3.x",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"MunifTanjim/nui.nvim",
			"nvim-tree/nvim-web-devicons", -- optional, but recommended
		},
		lazy = false, -- neo-tree will lazily load itself
		keys = {
			{
				"<leader>-",
				function()
					require("neo-tree.command").execute({
						action = "focus",
						source = "filesystem",
						position = "float",
						reveal = true,
					})
				end,
				desc = "Open File Explorer",
			},
		},
		opts = {
			popup_border_style = "solid",
			window = {
				popup = {
					size = { height = "100%", width = "100%" },
				},
			},
			filesystem = {
				follow_current_file = {
					enabled = true,
				},
			},
		},
	},
	{
		"antosha417/nvim-lsp-file-operations",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"nvim-neo-tree/neo-tree.nvim",
		},
		config = function()
			require("lsp-file-operations").setup()
		end,
	},
}
