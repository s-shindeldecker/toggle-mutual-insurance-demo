---
description: Required format for every task completion message
globs:
alwaysApply: true
---

# Task completion format

Every task completion message **must** include these four sections in order:

## Plan
One or two sentences stating what you intended to do and why.

## Changes made
A flat list of files created, modified, or deleted. One file per line.

## How to verify
The exact shell commands to confirm the change works. At minimum: `npm run verify`.

## Result
`PASS` or `FAIL`. If FAIL, state what broke and what you will do next.
