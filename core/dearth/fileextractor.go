package dearth

import (
	"crypto/sha1"
	"encoding/hex"
	"os"
	"path/filepath"
	"strings"

	"github.com/rryqszq4/go-murmurhash"

	"deearthx/core/util"
	"deearthx/core/ziputil"
)

// FileExtractor extracts information from JAR files
type FileExtractor struct {
	modsPath string
}

// NewFileExtractor creates a new FileExtractor
func NewFileExtractor(modsPath string) *FileExtractor {
	return &FileExtractor{modsPath: modsPath}
}

// ExtractFilesInfo extracts information from all JAR files in the mods directory
func (fe *FileExtractor) ExtractFilesInfo() ([]FileInfo, error) {
	jarFiles, err := fe.getJarFiles()
	if err != nil {
		return nil, err
	}

	util.Logger.Debug("正在提取模组文件信息", "数量", len(jarFiles))

	files := []FileInfo{}

	for _, jarFilename := range jarFiles {
		fullPath := filepath.Join(fe.modsPath, jarFilename)

		fileData, err := os.ReadFile(fullPath)
		if err != nil {
			util.Logger.Error("读取文件失败: " + fullPath + " - " + err.Error())
			continue
		}

		// Extract mixins and infos
		mixins := ziputil.ExtractMixins(fileData)
		infos := ziputil.ExtractModInfo(fileData)

		// Calculate SHA1 hash
		hash := calculateSHA1(fileData)

		// Calculate MurmurHash2 (CurseForge fingerprint)
		murmur2Hash := computeMurmurHash2(fileData)

		files = append(files, FileInfo{
			Filename: fullPath,
			Hash:     hash,
			Murmur2:  &murmur2Hash,
			Mixins:   convertZiputilMixins(mixins),
			Infos:    convertZiputilInfos(infos),
			FileData: fileData,
		})
	}

	util.Logger.Debug("模组文件信息提取完成", "已处理", len(files))
	return files, nil
}

func (fe *FileExtractor) getJarFiles() ([]string, error) {
	// Ensure directory exists
	os.MkdirAll(fe.modsPath, 0755)

	entries, err := os.ReadDir(fe.modsPath)
	if err != nil {
		return nil, err
	}

	jarFiles := []string{}
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".jar") {
			jarFiles = append(jarFiles, entry.Name())
		}
	}

	return jarFiles, nil
}

func calculateSHA1(data []byte) string {
	hash := sha1.Sum(data)
	return stringsToLower(hex.EncodeToString(hash[:]))
}

func computeMurmurHash2(data []byte) uint32 {
	// Filter out whitespace bytes (0x09, 0x0A, 0x0D, 0x20)
	filtered := make([]byte, 0, len(data))
	for _, b := range data {
		if b != 0x09 && b != 0x0A && b != 0x0D && b != 0x20 {
			filtered = append(filtered, b)
		}
	}

	// MurmurHash2 with seed=1 (CurseForge compatible)
	hash := murmurhash.MurmurHash2(filtered, 1)
	return hash
}

func stringsToLower(s string) string {
	result := make([]byte, len(s))
	for i, c := range s {
		if c >= 'A' && c <= 'Z' {
			result[i] = byte(c - 'A' + 'a')
		} else {
			result[i] = byte(c)
		}
	}
	return string(result)
}

func convertZiputilMixins(mixins []ziputil.MixinFile) []MixinFile {
	result := make([]MixinFile, len(mixins))
	for i, m := range mixins {
		result[i] = MixinFile{
			Name: m.Name,
			Data: m.Data,
		}
	}
	return result
}

func convertZiputilInfos(infos []ziputil.InfoFile) []InfoFile {
	result := make([]InfoFile, len(infos))
	for i, info := range infos {
		result[i] = InfoFile{
			Name: info.Name,
			Data: info.Data,
		}
	}
	return result
}