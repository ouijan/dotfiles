return {
	"catppuccin/nvim",
	name = "catppuccin",
	priority = 1000,
	opts = {
		auto_integrations = true,
	},
	config = function(_, opts)
		require("catppuccin").setup(opts)
		vim.cmd.colorscheme("catppuccin")

		local macchiato = require("catppuccin.palettes").get_palette("macchiato")

		vim.api.nvim_set_hl(0, "DiagnosticUnderlineError", {
			fg = macchiato.red,
			underline = false,
			undercurl = true,
		})
		vim.api.nvim_set_hl(0, "DiagnosticUnderlineWarn", {
			fg = macchiato.yellow,
			underline = false,
			undercurl = true,
		})
		vim.api.nvim_set_hl(0, "DiagnosticUnderlineInfo", {
			underline = false,
			undercurl = true,
		})
		vim.api.nvim_set_hl(0, "DiagnosticUnderlineHint", {
			underline = false,
			undercurl = true,
		})
	end,
}
