-- Seamless split/pane navigation with ctrl+hjkl.
-- Inside herdr: vim-herdr-navigation (vim-aware passthrough, falls back to
-- tmux/wincmd on its own). Otherwise: plain vim-tmux-navigator mappings.
local function herdr_nav_file()
	local pattern = "~/.config/herdr/plugins/github/vim-herdr-navigation-*/editor/nvim.lua"
	local matches = vim.fn.glob(pattern, true, true)
	return matches[1]
end

return {
	"christoomey/vim-tmux-navigator",
	lazy = false,
	init = function()
		vim.g.tmux_navigator_no_mappings = 1
	end,
	config = function()
		local nav_file = herdr_nav_file()
		if nav_file then
			dofile(nav_file)
			return
		end
		local map = vim.keymap.set
		map("n", "<c-h>", "<cmd>TmuxNavigateLeft<cr>")
		map("n", "<c-j>", "<cmd>TmuxNavigateDown<cr>")
		map("n", "<c-k>", "<cmd>TmuxNavigateUp<cr>")
		map("n", "<c-l>", "<cmd>TmuxNavigateRight<cr>")
		map("n", "<c-\\>", "<cmd>TmuxNavigatePrevious<cr>")
	end,
}
