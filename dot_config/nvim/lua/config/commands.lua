-- Manual commands

vim.api.nvim_create_user_command("OrganiseImports", function()
	ouijan.organise_imports()
end, { desc = "Sort TS imports" })

--  Auto commands
vim.api.nvim_create_autocmd("BufWritePre", {
	callback = function()
		ouijan.format()
	end,
})

vim.api.nvim_create_autocmd("BufReadPost", {
	callback = function()
		require("gitsigns").refresh()
	end,
})

vim.api.nvim_create_autocmd("User", {
	pattern = "GitWorktreeChanged",
	callback = function()
		ouijan.open_explorer()
		vim.uv.set_process_title("HI THERE")
		vim.opt.titlestring = "TITLEBABEnvim"
	end,
})

-- wgsl-analyzer answers the first diagnostic pull before it has finished
-- loading WESL packages, and nvim 0.11 has no `workspace/diagnostic/refresh`,
-- so the stale answer stays until the next edit. Pull again once the
-- analyzer reports its roots are scanned.
vim.api.nvim_create_autocmd("LspProgress", {
	group = vim.api.nvim_create_augroup("wgsl_analyzer_repull", { clear = true }),
	pattern = "end",
	callback = function(args)
		local client = vim.lsp.get_client_by_id(args.data.client_id)
		local scanned = args.data.params.token == "wgslAnalyzer/Roots Scanned"
		if not client or client.name ~= "wgsl_analyzer" or not scanned then
			return
		end
		for bufnr in pairs(client.attached_buffers) do
			local params = { textDocument = vim.lsp.util.make_text_document_params(bufnr) }
			client:request("textDocument/diagnostic", params, nil, bufnr)
		end
	end,
})
