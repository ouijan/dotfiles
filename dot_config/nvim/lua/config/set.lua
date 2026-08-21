vim.opt.updatetime = 50
-- Pick up edits made outside this instance (e.g. from a tuicr review tab)
vim.opt.autoread = true
vim.o.termguicolors = true
vim.g.have_nerd_font = true
-- "solid" is a border made of spaces: 1 char of padding on every side,
-- no drawn line. Floats that don't set `border` themselves inherit this.
-- NOTE: winborder is an OPTION (vim.o), not a variable. vim.g.winborder
-- silently does nothing.
vim.o.winborder = "solid"

-- Undercurl is driven by the Smulx/Setulc terminfo capabilities, not by
-- config. Neovim has no t_Cs/t_Ce (that's Vim only). See
-- ~/.config/terminfo/tmux-undercurl.src for the tmux entry that adds them.

vim.g.editorconfig = true

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
	-- Squiggles only. Inline text is too noisy with clippy pedantic on;
	-- read the full message with <leader>dk (vim.diagnostic.open_float).
	underline = true,
	virtual_text = false,
	virtual_lines = false,
	severity_sort = true,
	-- source = true names the linter (e.g. clippy) in the float.
	-- No `border` key: inherit vim.g.winborder for blank 1-char padding.
	float = { source = true },
	signs = true,
})

-- Sync clipboard between OS and Neovim.
vim.schedule(function()
	vim.opt.clipboard = "unnamedplus"
end)
