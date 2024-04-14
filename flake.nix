{
  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-23.11";

  outputs = { self, nixpkgs }:
    let pkgs = nixpkgs.legacyPackages.x86_64-linux;
    in {
      packages.x86_64-linux.default = pkgs.buildNpmPackage {
        name = "letscape";
        src = self;
        installPhase = ''
          mkdir -p $out/letscape
          cp -r . $out/letscape
        '';
        npmDepsHash = "sha256-l5qkQa+YeAqP2kIw1VMgy7wZYxP7C/Ck9lsF17O5SHM=";
      };
    };
}
