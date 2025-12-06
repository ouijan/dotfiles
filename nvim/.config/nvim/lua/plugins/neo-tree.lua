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
				-- width = 55,
				-- position = "float",
				popup = { -- settings that apply to float position only
					size = { height = "100%", width = "100%" },
					-- position = 0, -- 50% means center it
					-- win_options = {
					-- 	winblend = 10,
					-- 	winhighlight = "Normal:NormalFloat,FloatBorder:NormalFloat",
					-- },
				},
			},
			filesystem = {
				follow_current_file = {
                    enabled = true,
                },
			},
			default_component_configs = {
				git_status = {
					symbols = {
						-- Change type
						added = "+",
						deleted = "d",
						modified = "m",
						renamed = "r",
						-- Status type
						untracked = "?",
						ignored = "",
						unstaged = "u",
						staged = "s",
						conflict = "c",
					},
					align = "right",
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
