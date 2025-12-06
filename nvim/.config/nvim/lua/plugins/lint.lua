return {
	"nvimtools/none-ls.nvim",
	event = { "BufReadPre", "BufNewFile" },
	dependencies = {
		"williamboman/mason.nvim",
		"jay-babu/mason-null-ls.nvim", -- bridge mason and null-ls
	},
	opts = {
		-- events = { "BufWritePost", "BufReadPost", "InsertLeave" },
	},
}
