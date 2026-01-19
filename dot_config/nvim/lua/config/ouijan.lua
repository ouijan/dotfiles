local M = {}

--@diagnostic disable-next-line: lowercase-global
ouijan = M

M.format = function()
	M.organise_imports()
	require("conform").format({ async = false })
end

M.organise_imports = function()
	if vim.bo.filetype == "typescript" then
		local ok = vim.lsp.buf_request_sync(0, "workspace/executeCommand", {
			command = "typescript.organizeImports",
			arguments = { vim.api.nvim_buf_get_name(0) },
		}, 3000)
		if not ok then
			print("Organise imports timeout or failed to complete.")
		end
	end
end

M.commitizen = function()
	vim.api.nvim_command("belowright split | terminal cz commit")
	vim.api.nvim_command("resize 10")
	vim.api.nvim_command("startinsert")
end

M.open_explorer = function()
	require("neo-tree.command").execute({
		action = "focus",
		source = "filesystem",
		position = "float",
		reveal = true,
	})
end
