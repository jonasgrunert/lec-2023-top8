#!/bin/bash
curl -fsSL https://deno.land/x/install/install.sh | sh
deno task build
exit 0
