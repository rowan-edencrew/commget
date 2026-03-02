const crypto = require("crypto");
const axios = require("axios");

class CommunityAuth {
  /**
   * @param {Object} options
   * @param {string} options.custNum - 고객번호
   * @param {string} [options.hashedUserId] - 이미 해시된 user_id (앱의 $secure.makeHashData 결과값)
   */
  constructor({ custNum = "101834560", hashedUserId } = {}) {
    this.custNum = custNum;
    this.hashedUserId = hashedUserId || null;
    this.keyGenUrl = "https://gardenapi.nhsec.com/apiKeyPairGen";
    this.accessToken = null;
    this.refreshToken = null;
  }

  /**
   * SHA-256 해시 후 Base64 인코딩 (makeHashData 대응)
   */
  makeHashData(data) {
    return crypto.createHash("sha256").update(data, "utf8").digest("base64");
  }

  /**
   * RSA 공개키로 암호화 (encryptRSA 대응)
   */
  encryptRSA(data, publicKeyRaw) {
    const pem = `-----BEGIN PUBLIC KEY-----\n${publicKeyRaw}\n-----END PUBLIC KEY-----`;
    const encrypted = crypto.publicEncrypt(
      { key: pem, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(data, "utf8")
    );
    return encrypted.toString("base64");
  }

  /**
   * API 키 페어 생성 요청
   */
  async fetchPublicKey() {
    console.log("[Community Auth] Fetching public key from:", this.keyGenUrl);
    const { status, data } = await axios.get(this.keyGenUrl);
    console.log("[Community Auth] apiKeyPairGen status:", status);

    if (status !== 200) {
      throw new Error(`apiKeyPairGen failed with status ${status}`);
    }

    // 응답이 JSON 문자열로 래핑되어 올 수 있음
    const publicKey = typeof data === "string" ? data.replace(/^"|"$/g, "") : data;
    console.log("[Community Auth] Public key received:", publicKey.substring(0, 50) + "...");
    return publicKey;
  }

  /**
   * 커뮤니티 서버 로그인
   */
  async login() {
    if (this.accessToken) {
      console.log("[Community Auth] Already has access token, skipping login");
      return {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
      };
    }

    console.log("=== [Starting Community Login] ===");
    console.log("=== custNum ===", this.custNum);

    // 1. 공개키 가져오기
    const publicKey = await this.fetchPublicKey();

    // 2. custNum 해시 (hashedUserId가 있으면 직접 사용, 없으면 SHA-256)
    const hashed = this.hashedUserId || this.makeHashData(this.custNum);
    console.log("[Community Auth] hashed:", hashed);
    if (this.hashedUserId) {
      console.log("[Community Auth] Using pre-computed hashedUserId");
    }

    // 3. RSA 암호화 후 로그인 URL 구성
    const encrypted = this.encryptRSA(hashed, publicKey);
    const encodedUserData = encodeURIComponent(encrypted);
    const encodedKey = encodeURIComponent(publicKey);

    console.log("[Community Auth] encodedUserData:", encodedUserData.substring(0, 80) + "...");
    console.log("[Community Auth] encodedKey:", encodedKey.substring(0, 80) + "...");

    const loginUrl = `https://gardenapi.nhsec.com/login?user_id=${encodedUserData}&publicKey=${encodedKey}`;

    console.log("[Community Auth] Login URL:", loginUrl.substring(0, 100) + "...");

    // 4. 로그인 요청
    const response = await axios.get(loginUrl, {
      validateStatus: () => true, // 모든 상태 코드 허용
    });

    console.log("[Community Auth] Login response status:", response.status);
    console.log("[Community Auth] Login response headers:", JSON.stringify({
      "access-token": response.headers["access-token"] ? "present" : "missing",
      "refresh-token": response.headers["refresh-token"] ? "present" : "missing",
    }));

    const accessToken = response.headers["access-token"];
    const refreshToken = response.headers["refresh-token"];

    if (!accessToken) {
      throw new Error(
        `Login failed: no access-token in response (status: ${response.status}, body: ${JSON.stringify(response.data)})`
      );
    }

    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    console.log("[Community Auth] Login successful!");
    console.log("[Community Auth] Access token:", accessToken.substring(0, 30) + "...");
    console.log("[Community Auth] Refresh token:", refreshToken ? refreshToken.substring(0, 30) + "..." : "N/A");

    return { accessToken, refreshToken, body: response.data };
  }

  /**
   * 토큰 초기화 (재로그인용)
   */
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
  }
}

module.exports = CommunityAuth;
