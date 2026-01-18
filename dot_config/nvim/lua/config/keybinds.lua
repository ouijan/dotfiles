-- Nav keeping view centered
vim.keymap.set("n", "<C-d>", "<C-d>zz", { desc = "1/2 page down" })
vim.keymap.set("n", "<C-u>", "<C-u>zz", { desc = "1/2 page up" })
vim.keymap.set("n", "n", "nzzzv", { desc = "Next match" })
vim.keymap.set("n", "N", "nzzzv", { desc = "Previous match" })

-- Diagnostics
vim.keymap.set("n", "<leader>dp", function()
	vim.diagnostic.goto_prev()
end, { desc = "Diagnostic Previous" })
vim.keymap.set("n", "<leader>dn", function()
	vim.diagnostic.goto_next()
end, { desc = "Diagnostic Next" })
vim.keymap.set("n", "<leader>dk", function()
	vim.diagnostic.open_float({})
end, { desc = "Diagnostic Inspect" })

-- LSP
vim.keymap.set("n", "<leader>rn", function()
	vim.lsp.buf.rename()
end, { desc = "Rename Symbol" })
vim.keymap.set("n", "<leader>f", function()
	ouijan.format()
end, { desc = "Format" })

-- Git
vim.keymap.set("n", "<leader>gc", function()
	ouijan.commitizen()
end, { desc = "Git Conventional Commit" })
