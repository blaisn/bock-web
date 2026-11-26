#!/usr/bin/env bash
# Déploie l'application dans le bucket S3.
# Usage : scripts/deployer.sh NOM-DU-BUCKET [--avec-donnees]
#   --avec-donnees : envoie aussi bock.json (PREMIER déploiement seulement :
#                    sinon on écraserait les résultats publiés par le PC de saisie)
set -euo pipefail
BUCKET="${1:?Usage : scripts/deployer.sh NOM-DU-BUCKET [--avec-donnees]}"
cd "$(dirname "$0")/.."
npm run build
# Fichiers à noms versionnés (assets/) : cache long ; les autres : toujours revalider
aws s3 sync dist/assets "s3://$BUCKET/assets" --cache-control "public, max-age=31536000, immutable"
aws s3 sync dist "s3://$BUCKET" --exclude "assets/*" --exclude "bock.json" --cache-control "no-cache"
if [[ "${2:-}" == "--avec-donnees" ]]; then
  aws s3 cp dist/bock.json "s3://$BUCKET/bock.json" --cache-control "no-cache" --content-type "application/json; charset=utf-8"
fi
REGION="$(aws s3api get-bucket-location --bucket "$BUCKET" --query LocationConstraint --output text)"
[[ "$REGION" == "None" ]] && REGION="us-east-1"
echo "Déployé : https://$BUCKET.s3.$REGION.amazonaws.com/index.html"
