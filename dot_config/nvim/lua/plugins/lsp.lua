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
		dependencies = {
			{
				"j-hui/fidget.nvim",
				-- winblend = 0 keeps the popup transparent; the default (100) blends
				-- against a "none" background and renders solid black.
				opts = { notification = { window = { winblend = 0 } } },
			},
		},
		config = function()
			-- Servers provided by external toolchains (not mason) must be enabled explicitly.
			-- rust-analyzer + rustfmt + clippy come from rustup.
			vim.lsp.enable("rust_analyzer")
		end,
	},
}
