package download

import (
	"crypto/sha1"
	"encoding/hex"
	"io"
	"os"

	"deearthx/core/util"
)

// CalculateSHA1 calculates SHA1 hash of a file
func CalculateSHA1(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	hash := sha1.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	result := hex.EncodeToString(hash.Sum(nil))
	return stringsToLower(result), nil
}

// VerifySHA1 verifies a file's SHA1 hash against expected value
func VerifySHA1(filePath string, expectedHash string) (bool, error) {
	actualHash, err := CalculateSHA1(filePath)
	if err != nil {
		return false, err
	}

	expected := stringsToLower(expectedHash)
	isMatch := actualHash == expected

	if !isMatch {
		util.Logger.Error("File hash verification failed: " + filePath)
		util.Logger.Error("Expected: " + expected)
		util.Logger.Error("Actual: " + actualHash)
	} else {
		util.Logger.Debug("File hash verification passed: " + filePath + " (sha1: " + actualHash + ")")
	}

	return isMatch, nil
}

// CalculateSHA1FromBytes calculates SHA1 hash from byte data
func CalculateSHA1FromBytes(data []byte) string {
	hash := sha1.New()
	hash.Write(data)
	return stringsToLower(hex.EncodeToString(hash.Sum(nil)))
}

func stringsToLower(s string) string {
	result := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			result[i] = c - 'A' + 'a'
		} else {
			result[i] = c
		}
	}
	return string(result)
}