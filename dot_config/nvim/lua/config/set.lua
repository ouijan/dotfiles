vim.opt.updatetime = 50
vim.o.termguicolors = true
vim.g.have_nerd_font = true
vim.g.winborder = "solid"

-- loaders
vim.g.loaded_perl_provider = 0
vim.g.loaded_ruby_provider = 0
vim.g.python3_host_prog = "~/.pyenv/versions/nvim3/bin/python"
vim.g.node_host_prog = "/Users/tobyharris/Library/pnpm/global/5/node_modules/neovim/bin/cli.js"

vim.opt.nu = true

vim.opt.tabstop = 4
vim.opt.softtabstop = 4
vim.opt.shiftwidth = 4
vim.opt.expandtab = true
vim.opt.smartindent = true

vim.diagnostic.config({
	-- underline = true,
	-- virtual_text = false,
	-- virtual_lines = false, -- { current_line = true },
	-- signs = true,
	-- severity_sort = true,
	-- float = true,
})

-- Sync clipboard between OS and Neovim.
vim.schedule(function()
	vim.opt.clipboard = "unnamedplus"
end)
