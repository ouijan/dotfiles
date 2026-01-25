vim.opt.updatetime = 50
vim.o.termguicolors = true
vim.g.have_nerd_font = true
vim.g.winborder = "solid"

-- -- Terminal title - updates dynamically with git branch
-- -- tmux uses #{pane_title} for automatic-rename which picks this up
-- vim.opt.title = true
--
-- local function update_title()
-- 	local branch = vim.fn.system("git branch --show-current 2>/dev/null"):gsub("\n", "")
-- 	if branch == "" then
-- 		branch = vim.fn.fnamemodify(vim.fn.getcwd(), ":t")
-- 	end
-- 	vim.opt.titlestring = "nvim(" .. branch .. ")"
-- end
--
-- update_title()
-- vim.api.nvim_create_autocmd({ "DirChanged", "VimEnter" }, {
-- 	callback = update_title,
-- })

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
