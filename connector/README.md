# OfficeBridge 커넥터 — 실습 가이드

이 폴더 하나만 다른 머신(여러분의 로컬 PC 또는 별도 서버)에 옮기면 커넥터를 독립적으로 띄울 수 있습니다.
커넥터는 **아웃바운드로만** 릴레이에 연결합니다 — 이 머신에 인바운드 포트를 열 필요가 없습니다.

지금 릴레이는 `10.52.249.21:443`에서 이미 떠 있고, 이 폴더의 `config.js`에는 그 릴레이에 연결되도록
토큰이 미리 채워져 있습니다. 순서대로 따라 하면 됩니다.

---

## 0. 사전 확인 — 네트워크 도달성 (가장 먼저 확인!)

커넥터를 돌릴 머신에서 릴레이(`10.52.249.21:443`)로 **직접 접속 가능해야** 합니다.

```bash
# 커넥터를 돌릴 머신에서 실행
curl -k -sI https://10.52.249.21:443/ | head -1
```

`HTTP/1.1 ...` 응답이 오면 통과입니다. 아무 응답이 없거나 타임아웃이면:
- 릴레이와 같은 사설망(같은 공유기/VPC)에 있는지 확인
- 다른 네트워크(예: 집 와이파이, 다른 클라우드 리전)라면 `10.52.249.21`로는 절대 도달 못 합니다.
  이 경우 릴레이 쪽에 포트포워딩/공인 IP를 열어야 하며, 그 값을 아래 1번 단계의 `RELAY_HOST`에
  다시 넣어야 합니다.

---

## 1. Node.js 설치 확인

```bash
node --version   # 없으면 아래로 설치
```

없다면:

- **macOS**: `brew install node` (Homebrew 없으면 https://brew.sh 먼저), 또는 nodejs.org에서 `.pkg` 설치
- **RHEL/Rocky/CentOS**: `sudo dnf install -y nodejs`
- **Ubuntu/Debian**: `sudo apt-get install -y nodejs npm` 또는 nodesource 스크립트

macOS는 처음 `node index.js`를 실행할 때 방화벽이 "수신 연결을 허용하시겠습니까?" 팝업을 띄울 수 있습니다 —
허용해야 관리 웹 UI(7번)에 다른 기기에서 접속할 수 있습니다. 로컬(내 맥)에서만 관리 웹을 쓸 거면 무시해도 됩니다.

---

## 2. 이 폴더를 대상 머신으로 복사

**맥에서 테스트하는 경우**: 전달받은 `connector-kit.tar.gz`를 더블클릭(또는 `tar xzf connector-kit.tar.gz`)해서 풀면 끝입니다 — 이 단계는 건너뛰어도 됩니다.

별도 서버로 옮기는 경우, scp나 압축파일로 이동하면 됩니다.

```bash
# 예시: 이 릴레이 박스에서 대상 서버로 직접 복사하는 경우
scp -r connector-kit/ USER@대상서버:/원하는/경로/
```

USB, 압축 후 이메일/메신저 전송 등 어떤 방법이든 상관없습니다. 폴더 안의 파일 구성:

```
connector-kit/
  index.js            # 커넥터 본체 (수정할 필요 없음)
  admin-web.js        # 로컬 관리 웹 UI (수정할 필요 없음)
  state.js            # services.json 읽기/쓰기 + 변경 시 릴레이 재등록
  relay-client.js     # 관리 웹의 정책/로그 조회 카드가 쓰는 릴레이 API 클라이언트
  config.js           # 릴레이 주소/토큰 + 관리 웹 계정 (필요시 수정)
  services.json       # 서비스명 -> 내부 시스템 주소 매핑 (관리 웹에서 편집 권장)
  package.json
  mock-apps/          # 테스트용 가짜 내부 시스템 3종 (선택)
  start-mock-apps.sh  # 위 테스트 앱 실행 스크립트
  stop-mock-apps.sh
```

---

## 3. 의존성 설치

대상 머신에서:
```bash
cd connector-kit
npm install
```
`ws` 패키지 하나만 설치됩니다.

---

## 4. (선택) 테스트용 가짜 내부 시스템으로 먼저 연결 확인

실제 사내 시스템 주소를 아직 모르거나, 일단 터널이 붙는지부터 확인하고 싶다면:

```bash
bash start-mock-apps.sh
```

이러면 `127.0.0.1:8081/8082/8083`에 ERP/GitLab/Groupware 가짜 로그인 화면이 뜹니다.
`services.json`은 기본값이 이미 이 주소들을 가리키고 있으니 그대로 두면 됩니다.

나중에 정리하려면: `bash stop-mock-apps.sh`

---

## 5. `config.js` 확인

```js
module.exports = {
  RELAY_HOST: process.env.RELAY_HOST || '10.52.249.21',   // 릴레이 주소 (0번에서 확인한 값)
  RELAY_PORT: process.env.RELAY_PORT || '443',
  CONNECTOR_TOKEN: process.env.CONNECTOR_TOKEN || 'f8ab...', // 이미 이 릴레이용으로 채워져 있음
  REJECT_UNAUTHORIZED: process.env.REJECT_UNAUTHORIZED === 'true', // 자체서명 인증서라 기본 false 유지
};
```

**대부분의 경우 수정할 필요 없습니다.** 릴레이를 다른 곳으로 옮기거나 IP가 바뀌면 `RELAY_HOST`만 바꾸면 됩니다.
파일을 직접 고치는 대신 환경변수로 덮어써도 됩니다:
```bash
RELAY_HOST=1.2.3.4 node index.js
```

---

## 6. `services.json` 확인/수정 — **실제로 연결할 내부 시스템 주소**

형식은 `"서비스명": { "internalAddress": "...", "enabled": true }`:

```json
{
  "erp": { "internalAddress": "http://127.0.0.1:8081", "enabled": true },
  "gitlab": { "internalAddress": "http://127.0.0.1:8082", "enabled": true },
  "groupware": { "internalAddress": "http://127.0.0.1:8083", "enabled": true }
}
```

- **키(서비스명)**는 릴레이 관리자 콘솔의 [사내시스템 등록]에 등록된 이름과 **정확히 같아야** 합니다.
- **internalAddress**는 이 커넥터가 실제로 접근할 수 있는 사내 시스템 주소로 바꾸세요.
- **enabled**가 `false`이면 릴레이가 허용해도 이 커넥터가 전달하지 않습니다 (7번 관리 웹의 ON/OFF와 같은 값).
- 릴레이 관리자 콘솔에서 새 시스템을 등록하면 재시작 없이 여기 자동 추가됩니다(기본 enabled: true).
- **처음 설정 이후로는 이 파일을 직접 고치는 대신, 아래 7번 관리 웹 UI에서 추가/삭제/on-off 하는 걸 권장합니다** — 파일을 열어둔 채로 웹에서도 고치면 서로 덮어쓸 수 있습니다.

---

## 7. 실행 + 로컬 관리 웹 UI

```bash
node index.js
# 또는
npm start
```

성공하면 이렇게 뜹니다:
```
[connector] connecting to wss://10.52.249.21:443/tunnel?token=...
[connector] local admin UI on http://0.0.0.0:8090/ (user: admin)
[connector] WARNING: ADMIN_PASSWORD is still the default "changeme" — change it in config.js
[connector] tunnel established
[connector] registered with relay: erp, gitlab, groupware
```

연결이 끊기면 3초마다 자동 재연결을 시도합니다. 백그라운드로 계속 띄워두려면:
```bash
nohup node index.js > connector.log 2>&1 &
```

**관리 웹 UI**는 커넥터 프로세스 안에서 같이 뜨는 별도 포트(기본 `8090`)입니다. 브라우저로
`http://<이 커넥터를 돌리는 머신의 IP>:8090/` 접속 (계정: `config.js`의 `ADMIN_USER`/`ADMIN_PASSWORD`,
기본 `admin` / `changeme`) 하면:

- **연결 상태** — 릴레이에 지금 붙어있는지
- **도메인(서비스) 관리** — 서비스명·내부주소 추가, 삭제, ON/OFF 토글
  - OFF로 끄면 릴레이 쪽 정책이 허용해도 이 커넥터가 로컬에서 막습니다 (커넥터 운영자의 자체 정책)
  - 추가/삭제/토글하는 즉시 릴레이에 재등록되어 반영됩니다 (재시작 불필요)
- **정책 조회 (읽기 전용)** — 이 커넥터가 릴레이에 등록한 서비스별로 어떤 부서/개인이 접근 허용됐는지 보여줍니다.
  실제 부서×서비스 정책은 릴레이 관리자 콘솔에서만 바꿀 수 있고, 여기서는 조회만 됩니다 (`relay-client.js`가
  릴레이의 `/_ob/api/connector/policy` API를 커넥터 토큰으로 호출).
- **최근 접속 로그 (읽기 전용)** — 이 커넥터가 처리한 서비스로의 접속만 릴레이 감사로그에서 필터링해 보여줍니다
  (`/_ob/api/connector/logs`). 릴레이가 응답하지 않으면 카드에 오류 메시지만 표시되고 나머지 화면은 그대로 뜹니다.

**보안 필수**: `ADMIN_PASSWORD`를 기본값(`changeme`)에서 반드시 바꾸세요. 사내망 밖에서 접근할
필요가 없다면 `config.js`의 `ADMIN_HOST`를 `127.0.0.1`로 바꿔 로컬 전용으로 제한하는 것도 방법입니다.

```bash
# 예: 계정/비밀번호를 환경변수로 덮어쓰며 실행
ADMIN_PASSWORD='더강한비밀번호' ADMIN_HOST=127.0.0.1 node index.js
```

---

## 8. 정상 연결 확인

- 커넥터 콘솔에 `tunnel established`가 떴는지
- 릴레이 관리자 콘솔 대시보드(`https://admin.10-52-249-21.sslip.io/dashboard`)의
  **"커넥터 상태"** 타일이 `연결됨`으로 바뀌었는지
- 관리 웹 UI(`http://<커넥터 머신 IP>:8090/`)에서도 "연결됨"으로 뜨는지
- 브라우저로 `https://erp.10-52-249-21.sslip.io/` 접속 시 (릴레이에 로그인 후) 실제로
  이 커넥터가 물고 있는 내부 시스템 화면이 뜨는지

---

## 트러블슈팅

| 증상 | 원인/조치 |
|---|---|
| `connecting to wss://...` 만 반복되고 연결 안 됨 | 0번 네트워크 도달성부터 재확인. 방화벽이 대상 서버의 아웃바운드 443을 막고 있을 수 있음 |
| `401` 관련 오류 / 릴레이 로그에 "rejected connector: bad token" | `config.js`의 `CONNECTOR_TOKEN`이 릴레이의 `data/tokens.json`과 다름. 릴레이 쪽 값과 맞추세요 |
| `unable to verify the first certificate` 등 TLS 오류 | 릴레이가 자체 서명 인증서를 씁니다. `REJECT_UNAUTHORIZED`를 `true`로 바꾸지 마세요 (기본 `false`가 맞음) |
| 릴레이 대시보드엔 연결됐다고 뜨는데 서비스 접속 시 504 | `services.json`의 내부주소가 실제로 이 머신에서 접근 안 되는 주소. `curl <내부주소>`로 로컬에서 먼저 확인 |
| 릴레이 대시보드엔 연결됐다고 뜨는데 502 | 서비스가 관리 웹에서 OFF 상태이거나, 이름 철자가 릴레이 쪽과 다름 |
| 관리 웹 UI 접속 시 브라우저 로그인 창이 계속 뜸 | `config.js`의 `ADMIN_USER`/`ADMIN_PASSWORD`와 입력값이 일치하는지 확인 |
| 다른 PC에서 관리 웹 UI(`:8090`)가 안 열림 | `ADMIN_HOST`가 `127.0.0.1`로 설정되어 로컬 전용이거나, 방화벽이 8090 포트를 막고 있음 |

---

## 실제 사내 시스템으로 전환할 때 체크리스트

1. 관리 웹 UI에서 `ADMIN_PASSWORD`부터 바꾸세요 (기본값 `changeme` 그대로 두지 말 것)
2. 관리 웹 UI에서 테스트용 mock 서비스를 삭제하고, 실제 ERP/그룹웨어 등 내부주소로 새로 등록
3. 그 주소가 **이 커넥터를 돌리는 머신에서** 네트워크로 도달 가능한지 `curl`로 확인
4. `start-mock-apps.sh`로 띄운 테스트 앱은 정리 (`stop-mock-apps.sh`)
5. 커넥터를 서비스로 상시 구동하고 싶다면 systemd 유닛이나 `pm2` 같은 프로세스 매니저 사용 권장
   (이 실습 스크립트의 `nohup`은 데모/테스트 용도)
