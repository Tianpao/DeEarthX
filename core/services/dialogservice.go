package services

import (
	"syscall"
	"unsafe"
)

var (
	comdlg32                  = syscall.NewLazyDLL("comdlg32.dll")
	shell32                   = syscall.NewLazyDLL("shell32.dll")
	procGetOpenFileNameW      = comdlg32.NewProc("GetOpenFileNameW")
	procSHBrowseForFolderW    = shell32.NewProc("SHBrowseForFolderW")
	procSHGetPathFromIDListW  = shell32.NewProc("SHGetPathFromIDListW")
)

type openfilename struct {
	lStructSize       uint32
	hwndOwner         syscall.Handle
	hInstance         syscall.Handle
	lpstrFilter       *uint16
	lpstrCustomFilter *uint16
	nMaxCustFilter    uint32
	nFilterIndex      uint32
	lpstrFile         *uint16
	nMaxFile          uint32
	lpstrFileTitle    *uint16
	nMaxFileTitle     uint32
	lpstrInitialDir   *uint16
	lpstrTitle        *uint16
	flags             uint32
	nFileOffset       uint16
	nFileExtension    uint16
	lpstrDefExt       *uint16
	lCustData         uintptr
	lpfnHook          uintptr
	lpTemplateName    *uint16
}

const (
	OFN_FILEMUSTEXIST = 0x1000
	OFN_HIDEREADONLY  = 0x4
)

type browseinfo struct {
	hwndOwner      syscall.Handle
	pidlRoot       uintptr
	pszDisplayName *uint16
	lpszTitle      *uint16
	ulFlags        uint32
	lpfn           uintptr
	lParam         uintptr
	iImage         int32
}

const (
	BIF_RETURNONLYFSDIRS = 0x0001
	BIF_NEWDIALOGSTYLE   = 0x0040
	MAX_PATH             = 260
)

// DialogService provides native file dialogs
type DialogService struct{}

// NewDialogService creates a new DialogService
func NewDialogService() *DialogService {
	return &DialogService{}
}

// OpenFile opens a native Windows file picker and returns the selected path.
// extensions is a list of file extensions like ["*.zip", "*.mrpack"]
func (s *DialogService) OpenFile(extensions []string) string {
	buf := make([]uint16, 1024)
	buf[0] = 0

	// Build filter string: "Files\0*.zip;*.mrpack\0\0"
	filterPattern := ""
	for i, ext := range extensions {
		if i > 0 {
			filterPattern += ";"
		}
		filterPattern += ext
	}

	displayName := "Files (" + filterPattern + ")"
	filterStr := syscall.StringToUTF16(displayName)
	filterStr = append(filterStr, syscall.StringToUTF16(filterPattern)...)
	filterStr = append(filterStr, 0)

	title, _ := syscall.UTF16PtrFromString("Select file")

	ofn := openfilename{
		lStructSize: uint32(unsafe.Sizeof(openfilename{})),
		lpstrFilter: &filterStr[0],
		lpstrFile:   &buf[0],
		nMaxFile:    uint32(len(buf)),
		lpstrTitle:  title,
		flags:       OFN_FILEMUSTEXIST | OFN_HIDEREADONLY,
	}

	ret, _, _ := procGetOpenFileNameW.Call(uintptr(unsafe.Pointer(&ofn)))
	if ret == 0 {
		return ""
	}

	return syscall.UTF16ToString(buf)
}

// OpenDirectory opens a native Windows folder picker and returns the selected path.
func (s *DialogService) OpenDirectory() string {
	title, _ := syscall.UTF16PtrFromString("Select folder")

	bi := browseinfo{
		lpszTitle: title,
		ulFlags:   BIF_RETURNONLYFSDIRS | BIF_NEWDIALOGSTYLE,
	}

	ret, _, _ := procSHBrowseForFolderW.Call(uintptr(unsafe.Pointer(&bi)))
	if ret == 0 {
		return ""
	}

	buf := make([]uint16, MAX_PATH)
	r, _, _ := procSHGetPathFromIDListW.Call(ret, uintptr(unsafe.Pointer(&buf[0])))
	if r == 0 {
		return ""
	}

	return syscall.UTF16ToString(buf)
}
