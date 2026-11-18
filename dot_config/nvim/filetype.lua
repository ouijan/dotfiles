-- WESL is WGSL plus `import`. Treat it as wgsl so treesitter and
-- wgsl-analyzer attach with no extra wiring. The analyzer picks WESL
-- mode from the file extension, not the filetype.
vim.filetype.add({ extension = { wesl = "wgsl" } })
