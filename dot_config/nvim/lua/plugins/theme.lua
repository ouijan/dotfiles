return {
	"catppuccin/nvim",
	name = "catppuccin",
	lazy = false,
	priority = 1000,
	opts = {
		auto_integrations = true,
		transparent_background = true,
	},
	config = function(_, opts)
		require("catppuccin").setup(opts)
		vim.cmd.colorscheme("catppuccin")

		local macchiato = require("catppuccin.palettes").get_palette("macchiato")

		-- Diagnostic spans: flat underline plus a dim background tint.
		--
		-- Never set `fg` here; it repaints the text and clobbers treesitter's
		-- syntax colours. `sp` would be the right way to colour the underline,
		-- but herdr drops SGR 58 (underline colour), so the line always renders
		-- in the text colour and is easy to miss. `bg` is the only channel that
		-- reliably marks the span without touching the syntax colours.
		-- Catppuccin's palette holds "#rrggbb" strings, not numbers.
		local function channels(hex)
			local red, green, blue = hex:match("^#(%x%x)(%x%x)(%x%x)$")
			return tonumber(red, 16), tonumber(green, 16), tonumber(blue, 16)
		end

		-- Mix `hex` into the background by `amount` (0 = invisible, 1 = full).
		local function tint(hex, amount)
			local red, green, blue = channels(hex)
			local base_red, base_green, base_blue = channels(macchiato.base)
			local function mix(from, to)
				return math.floor(from + (to - from) * amount)
			end
			return string.format(
				"#%02x%02x%02x",
				mix(base_red, red),
				mix(base_green, green),
				mix(base_blue, blue)
			)
		end

		local severity_colours = {
			DiagnosticUnderlineError = macchiato.red,
			DiagnosticUnderlineWarn = macchiato.yellow,
			DiagnosticUnderlineInfo = macchiato.sky,
			DiagnosticUnderlineHint = macchiato.teal,
		}
		for group, colour in pairs(severity_colours) do
			vim.api.nvim_set_hl(0, group, {
				sp = colour,
				bg = tint(colour, 0.18),
				underline = true,
				undercurl = false,
			})
		end
	end,
}
