return {
	{
		"mason-org/mason.nvim",
		opts = {},
	},
	{
		"WhoIsSethDaniel/mason-tool-installer.nvim",
		dependencies = { "williamboman/mason.nvim" },
		opts = {
			ensure_installed = {
				-- LSPs
				"lua-language-server",
				-- "gopls",
				-- "vtsls",
				-- "eslint-lsp",
				-- "tailwindcss-language-server",
				-- "angular-language-server",
				-- "clangd",

				-- Formatters
				"stylua",
				-- "prettierd",
				-- "goimports",
				-- "golines",
				-- "gofumpt",
				-- "clang-format",

				-- DAPs
				-- "delve", -- Go debugger
				-- "cppdbg", -- C/C++ debugger
			},
		},
	},
	{
		"mason-org/mason-lspconfig.nvim",
		opts = {},
	},
	{
		"neovim/nvim-lspconfig",
		dependencies = { "j-hui/fidget.nvim", opts = {} },
		config = function()
			-- Config
		end,
	},
}
