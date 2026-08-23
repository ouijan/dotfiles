return {
	{
		"nvim-treesitter/nvim-treesitter",
		-- The `main` branch is the incompatible rewrite; this config uses the
		-- classic `nvim-treesitter.configs` API which only exists on `master`.
		branch = "master",
		build = ":TSUpdate",
		config = function()
			local configs = require("nvim-treesitter.configs")
			configs.setup({
				ensure_installed = {
					"c",
					"lua",
					"vim",
					"vimdoc",
					"query",
					"go",
					"javascript",
					"typescript",
					"html",
					"markdown",
					"markdown_inline",
					"rust",
					"toml",
					"ron",
				},
				sync_install = false,
				highlight = { enable = true },
				indent = { enable = true },
			})
		end,
	},
	{
		"nvim-treesitter/nvim-treesitter-context",
		branch = "master",
		dependencies = { "nvim-treesitter/nvim-treesitter" },
		opts = {},
	},
}
