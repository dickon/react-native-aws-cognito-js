/*!
 * Copyright 2016 Amazon.com,
 * Inc. or its affiliates. All Rights Reserved.
 *
 * Licensed under the Amazon Software License (the "License").
 * You may not use this file except in compliance with the
 * License. A copy of the License is located at
 *
 *     http://aws.amazon.com/asl/
 *
 * or in the "license" file accompanying this file. This file is
 * distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
 * CONDITIONS OF ANY KIND, express or implied. See the License
 * for the specific language governing permissions and
 * limitations under the License.
 */

import { util } from 'aws-sdk/dist/aws-sdk-react-native';

import BigInteger from './BigInteger';

const initN = 'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1'
  + '29024E088A67CC74020BBEA63B139B22514A08798E3404DD'
  + 'EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245'
  + 'E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED'
  + 'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D'
  + 'C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F'
  + '83655D23DCA3AD961C62F356208552BB9ED529077096966D'
  + '670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B'
  + 'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9'
  + 'DE2BCBF6955817183995497CEA956AE515D2261898FA0510'
  + '15728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64'
  + 'ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7'
  + 'ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6B'
  + 'F12FFA06D98A0864D87602733EC86A64521F2B18177B200C'
  + 'BBE117577A615D6C770988C0BAD946E208E24FA074E5AB31'
  + '43DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF';

const newPasswordRequiredChallengeUserAttributePrefix = 'userAttributes.';

/** @class */
export default class AuthenticationHelper {
  /**
   * Constructs a new AuthenticationHelper object
   * @param {string} PoolName Cognito user pool name.
   */
  constructor(PoolName) {
    this.N = new BigInteger(initN, 16);
    this.g = new BigInteger('2', 16);
    this.k = new BigInteger(this.hexHash(`00${this.N.toString(16)}0${this.g.toString(16)}`), 16);

    this.smallAValue = this.generateRandomSmallA();

    this.calculateA(this.smallAValue, (err, result) => {
      if (err) {
        throw new Error(err);
        return;
      }
      this.largeAValue = result;
    });

    this.infoBits = new util.Buffer('Caldera Derived Key', 'utf8');

    this.poolName = PoolName;
  }

  /**
   * Calculate mod pow with target, value and modifier.
   * @param {BigInteger} target Target to run mod pow against.
   * @param {BigInteger} value Actual mod pow value.
   * @param {BigInteger} modifier Modifier value for mod pow.
   * @param {object} callback Result callback map.
   * @returns {void}
   */
  computeModPow(target, value, modifier, callback) {
    try {
      const result = target.modPow(value, modifier);
      return callback(null, result);
    } catch (err) {
      return callback(err, null);
    }
  }

  /**
   * @returns {BigInteger} small A, a random number
   */
  getSmallAValue() {
    return this.smallAValue;
  }

  /**
   * @returns {BigInteger} large A, a value generated from small A
   */
  getLargeAValue() {
    return this.largeAValue;
  }

  /**
   * helper function to generate a random big integer
   * @returns {BigInteger} a random value.
   * @private
   */
  generateRandomSmallA() {
    const hexRandom = util.crypto.lib.randomBytes(128).toString('hex');

    const randomBigInt = new BigInteger(hexRandom, 16);
    const smallABigInt = randomBigInt.mod(this.N);

    return smallABigInt;
  }

  /**
   * helper function to generate a random string
   * @returns {string} a random value.
   * @private
   */
  generateRandomString() {
    return util.crypto.lib.randomBytes(40).toString('base64');
  }

  /**
   * @returns {string} Generated random value included in password hash.
   */
  getRandomPassword() {
    return this.randomPassword;
  }

  /**
   * @returns {string} Generated random value included in devices hash.
   */
  getSaltDevices() {
    return this.SaltToHashDevices;
  }

  /**
   * @returns {string} Value used to verify devices.
   */
  getVerifierDevices() {
    return this.verifierDevices;
  }

  /**
   * Generate salts and compute verifier.
   * @param {string} deviceGroupKey Devices to generate verifier for.
   * @param {string} username User to generate verifier for.
   * @returns {void}
   */
  generateHashDevice(deviceGroupKey, username) {
    this.randomPassword = this.generateRandomString();
    const combinedString = `${deviceGroupKey}${username}:${this.randomPassword}`;
    const hashedString = this.hash(combinedString);

    const hexRandom = util.crypto.lib.randomBytes(16).toString('hex');
    this.SaltToHashDevices = this.padHex(new BigInteger(hexRandom, 16));

    this.computeModPow(this.g, new BigInteger(this.hexHash(this.SaltToHashDevices + hashedString), 16), this.N, (err, result) => {
      if (err) {
        throw new Error(err);
        return;
      }
      const verifierDevicesNotPadded = result;
      this.verifierDevices = this.padHex(verifierDevicesNotPadded);
    });
  }

  /**
   * Calculate the client's public value A = g^a%N
   * with the generated random number a
   * @param {BigInteger} a Randomly generated small A.
   * @param {object} callback Result callback map.
   * @returns {void}
   * @private
   */
  calculateA(a, callback) {
    this.computeModPow(this.g, a, this.N, (err, result) => {
      if (err) {
        return callback(new Error(err), null);
      }
      const A = result;
      if (A.mod(this.N).equals(BigInteger.ZERO)) {
        return callback(new Error('Illegal paramater. A mod N cannot be 0.'), null);
      }
      return callback(null, A);
    });
    return undefined;
  }

  /**
   * Calculate the client's public value S
   * @param {BigInteger} xValue Hash salted password.
   * @param {BigInteger} serverBValue Server B value.
   * @param {object} callback Result callback map.
   * @returns {void}
   * @private
   */
  calculateS(xValue, serverBValue, callback) {
    this.computeModPow(this.g, xValue, this.N, (err, result) => {
      if (err) {
        return callback(new Error(err), null);
      }
      const gModPowXN = result;
      const intValue2 = serverBValue.subtract(this.k.multiply(gModPowXN));
      return this.calculateIntValue2(xValue, intValue2, callback);
    });
    return undefined;
  }

  /**
   * Calculate intValue2
   * @param {BigInteger} xValue Hash salted password.
   * @param {BigInteger} serverBValue Server B value.
   * @param {object} callback Result callback map.
   * @returns {void}
   * @private
   */
  calculateIntValue2(xValue, intValue2, callback) {
    this.computeModPow(intValue2, this.smallAValue.add(this.UValue.multiply(xValue)), this.N, (err, result) => {
      if (err) {
        return callback(new Error(err), null);
      }
      const sValue = result.mod(this.N);
      return callback(null, sValue);
    });
    return undefined;
  }

  /**
   * Calculate the client's value U which is the hash of A and B
   * @param {BigInteger} A Large A value.
   * @param {BigInteger} B Server B value.
   * @returns {BigInteger} Computed U value.
   * @private
   */
  calculateU(A, B) {
    this.UHexHash = this.hexHash(this.padHex(A) + this.padHex(B));
    const finalU = new BigInteger(this.UHexHash, 16);

    return finalU;
  }

  /**
   * Calculate a hash from a bitArray
   * @param {Buffer} buf Value to hash.
   * @returns {String} Hex-encoded hash.
   * @private
   */
  hash(buf) {
    const hashHex = util.crypto.sha256(buf, 'hex');
    return (new Array(64 - hashHex.length).join('0')) + hashHex;
  }

  /**
   * Calculate a hash from a hex string
   * @param {String} hexStr Value to hash.
   * @returns {String} Hex-encoded hash.
   * @private
   */
  hexHash(hexStr) {
    return this.hash(new util.Buffer(hexStr, 'hex'));
  }

  /**
   * Standard hkdf algorithm
   * @param {Buffer} ikm Input key material.
   * @param {Buffer} salt Salt value.
   * @returns {Buffer} Strong key material.
   * @private
   */
  computehkdf(ikm, salt) {
    const prk = util.crypto.hmac(salt, ikm, 'buffer', 'sha256');
    const infoBitsUpdate = util.buffer.concat([
      this.infoBits,
      new util.Buffer(String.fromCharCode(1), 'utf8'),
    ]);
    const hmac = util.crypto.hmac(prk, infoBitsUpdate, 'buffer', 'sha256');
    return hmac.slice(0, 16);
  }

  /**
   * Calculates the final hkdf based on computed S value, and computed U value and the key
   * @param {String} username Username.
   * @param {String} password Password.
   * @param {BigInteger} serverBValue Server B value.
   * @param {BigInteger} salt Generated salt.
   * @param {object} callback Result callback map.
   * @returns {void}
   */
  getPasswordAuthenticationKey(username, password, serverBValue, salt, callback) {
    if (serverBValue.mod(this.N).equals(BigInteger.ZERO)) {
      callback(new Error('B cannot be zero.'), null);
    }

    this.UValue = this.calculateU(this.largeAValue, serverBValue);

    if (this.UValue.equals(BigInteger.ZERO)) {
      callback(new Error('U cannot be zero.'), null);
    }

    const usernamePassword = `${this.poolName}${username}:${password}`;
    const usernamePasswordHash = this.hash(usernamePassword);

    const xValue = new BigInteger(this.hexHash(this.padHex(salt) + usernamePasswordHash), 16);

    this.calculateS(xValue, serverBValue, (err, result) => {
      if (err) {
        throw new Error(err);
        return;
      }
      const sValue = result;
      const hkdf = this.computehkdf(
        new util.Buffer(this.padHex(sValue), 'hex'),
        new util.Buffer(this.padHex(this.UValue.toString(16)), 'hex'));
      callback(null, hkdf);
    });
    return undefined;
  }

  /**
  * Return constant newPasswordRequiredChallengeUserAttributePrefix
  * @return {newPasswordRequiredChallengeUserAttributePrefix} constant prefix value
  */
  getNewPasswordRequiredChallengeUserAttributePrefix() {
    return newPasswordRequiredChallengeUserAttributePrefix;
  }

  /**
   * Converts a BigInteger (or hex string) to hex format padded with zeroes for hashing
   * @param {BigInteger|String} bigInt Number or string to pad.
   * @returns {String} Padded hex string.
   */
  padHex(bigInt) {
    let hashStr = bigInt.toString(16);
    if (hashStr.length % 2 === 1) {
      hashStr = `0${hashStr}`;
    } else if ('89ABCDEFabcdef'.indexOf(hashStr[0]) !== -1) {
      hashStr = `00${hashStr}`;
    }
    return hashStr;
  }
}
