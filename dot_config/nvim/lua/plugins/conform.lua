return {
	"stevearc/conform.nvim",
	opts = {
		formatters_by_ft = {
			lua = { "stylua" },
			javascript = { "prettierd" },
			typescript = { "prettierd" },
			html = { "prettierd" },
			htmlangular = { "prettierd" },
			css = { "prettierd" },
			scss = { "prettierd" },
			json = { "prettierd" },
			markdown = { "prettierd" },
			go = { "goimports", "golines", "gofumpt" },
			cpp = { "clang-format" },
			rust = { "rustfmt" },
		},
		formatters = {
			rustfmt = {
				-- conform assumes edition 2015 when it cannot read Cargo.toml
				options = { default_edition = "2021" },
			},
		},
		format_on_save = {
			timeout_ms = 500,
			lsp_format = "fallback",
		},
	},
}
