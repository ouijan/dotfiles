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
