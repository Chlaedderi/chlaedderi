# Chlädderi – what a CI runner adds to the development environment.
#
# Every job in .github/workflows/ copies this over devenv.local.nix before it enters a devenv
# shell, and devenv merges that file over devenv.nix. That is the whole of it: `env.cicd` goes
# true, and the packages that exist only for a person in a shell drop out of the closure the
# runner has to build. The checks themselves are unchanged -- everything a hook or a script
# reaches for is in the list that is always there.
#
# The flag is read at evaluation time, not from the environment, so nothing here needs --impure
# and a runner's own `CI` variable is never consulted. To see what a runner sees, copy it by hand:
#
#   cp tools/cicd.nix devenv.local.nix   # and remember your own devenv.local.nix, if you have one
#
{ env.cicd = true; }
