return {
	cmd = { "rust-analyzer" },
	on_attach = function(_, bufnr)
		-- Server-side hints are configured below, but nvim still needs them turned on.
		vim.lsp.inlay_hint.enable(true, { bufnr = bufnr })
	end,
	filetypes = { "rust" },
	root_markers = { "Cargo.toml", "rust-project.json", ".git" },
	settings = {
		["rust-analyzer"] = {
			cargo = {
				allFeatures = true,
				buildScripts = { enable = true },
			},
			-- Use clippy for on-save diagnostics instead of plain cargo check.
			-- Do NOT add --all-targets to extraArgs: rust-analyzer already passes
			-- it (check.allTargets defaults to true) and cargo rejects the
			-- duplicate flag, killing the whole flycheck silently.
			check = { command = "clippy" },
			procMacro = { enable = true },
			imports = {
				granularity = { group = "module" },
				prefix = "self",
			},
			inlayHints = {
				closureReturnTypeHints = { enable = "always" },
				parameterHints = { enable = true },
				typeHints = { enable = true },
			},
			files = {
				excludeDirs = { ".git", "target", "node_modules" },
			},
		},
	},
}
