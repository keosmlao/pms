#!/usr/bin/env bash
# ດີພລອຍ PM ຂຶ້ນ server ຈິງ — ດຶງໂຄດ · ບິວ · restart · ກວດວ່າຂຶ້ນແທ້
#
# ໃຊ້: npm run deploy          (ຈະຖາມລະຫັດຜ່ານ ssh)
#      DEPLOY_PORT=3100 npm run deploy
set -euo pipefail

# ໄອພີ **ວົງໃນ** ຄືກັນກັບແອັບ SALE (ໄອພີສາທາລະນະເກົ່າ 202.137.144.138
# ຊີ້ໄປເຄື່ອງອື່ນແລ້ວ — port 22 ຕອບເປັນ RouterOS).
HOST="${DEPLOY_HOST:-odg@10.0.40.9}"
DIR="${DEPLOY_DIR:-~/pms}"
SERVICE="${DEPLOY_SERVICE:-pms}"
PORT="${DEPLOY_PORT:-3100}"

echo "── ດຶງໂຄດ · ບິວ · restart ($SERVICE) ──"
# shellcheck disable=SC2029  # ຕັ້ງໃຈໃຫ້ຂະຫຍາຍຢູ່ຝັ່ງນີ້
ssh "$HOST" "set -e
  cd $DIR
  git pull
  npm ci --omit=dev --no-audit --no-fund || npm install
  npm run build
  sudo systemctl restart $SERVICE
  sleep 4
  systemctl is-active $SERVICE
  curl -s -o /dev/null -w 'ໜ້າສິນຄ້າ HTTP %{http_code} · %{time_total}s\n' localhost:$PORT/products
  echo \"ຮອດ commit: \$(git log --oneline -1)\""
