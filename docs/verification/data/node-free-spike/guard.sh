#!/bin/bash
f=$(perl -MJSON::PP -e 'local $/; my $d = decode_json(<STDIN>); print $d->{tool_input}{file_path}' | tr "\\" "/")
case "$f" in
  */src/*) echo "proto-guard(sh+perl): src write blocked, grade not recorded" >&2; exit 2;;
esac
exit 0
