{ pkgs ? import <nixpkgs> { } }:
pkgs.buildNpmPackage {
  name = "letscape";
  src = ./.;
  installPhase = ''
    mkdir $out
    cp -r . $out
  '';
  npmDepsHash = "sha256-l5qkQa+YeAqP2kIw1VMgy7wZYxP7C/Ck9lsF17O5SHM=";
}
