;; extends

; WESL `import` lines. The wgsl grammar has no rule for them, so each one
; parses as an ERROR node. Colour the words of an ERROR that starts with
; `import` and leave every other ERROR alone.
(ERROR
  .
  (identifier) @keyword.import
  (#eq? @keyword.import "import"))

(ERROR
  .
  (identifier) @_import
  (identifier) @module
  (#eq? @_import "import"))
