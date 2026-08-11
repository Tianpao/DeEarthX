//go:build windows

package utils

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"sync"
	"unsafe"

	"golang.org/x/sys/windows"
)

// runShellCommand runs a command line via cmd.exe inside a Windows Job Object
// with JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE. When this process exits (normally or
// by being killed), the entire child process tree (cmd.exe + java, etc.) is
// terminated, so no orphan processes are left behind. Returns combined output.
func runShellCommand(command, cwd string) ([]byte, error) {
	// Create a job that kills the whole process tree when its handle closes.
	job, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return nil, fmt.Errorf("create job object: %w", err)
	}
	defer windows.CloseHandle(job)

	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{}
	info.BasicLimitInformation.LimitFlags = windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
	if _, err := windows.SetInformationJobObject(job, windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)), uint32(unsafe.Sizeof(info))); err != nil {
		return nil, fmt.Errorf("set job info: %w", err)
	}

	// Capture stdout/stderr via anonymous pipes so output survives for errors.
	stdoutR, stdoutW, err := os.Pipe()
	if err != nil {
		return nil, err
	}
	stderrR, stderrW, err := os.Pipe()
	if err != nil {
		stdoutR.Close()
		stdoutW.Close()
		return nil, err
	}
	nul, err := os.OpenFile("NUL", os.O_RDONLY, 0)
	if err != nil {
		stdoutR.Close()
		stdoutW.Close()
		stderrR.Close()
		stderrW.Close()
		return nil, err
	}

	var si windows.StartupInfo
	si.Cb = uint32(unsafe.Sizeof(si))
	si.Flags = windows.STARTF_USESTDHANDLES
	si.StdInput = windows.Handle(nul.Fd())
	si.StdOutput = windows.Handle(stdoutW.Fd())
	si.StdErr = windows.Handle(stderrW.Fd())

	cmdline, err := windows.UTF16PtrFromString("cmd.exe /C " + command)
	if err != nil {
		return nil, err
	}
	var cwdPtr *uint16
	if cwd != "" {
		cwdPtr, err = windows.UTF16PtrFromString(cwd)
		if err != nil {
			return nil, err
		}
	}

	// Create the process suspended, assign it to the job, then resume. This
	// guarantees cmd.exe (and every process it later spawns) is born inside the
	// job, so the whole tree is tied to our lifetime.
	var pi windows.ProcessInformation
	err = windows.CreateProcess(nil, cmdline, nil, nil, true,
		windows.CREATE_SUSPENDED|windows.CREATE_NEW_PROCESS_GROUP,
		nil, cwdPtr, &si, &pi)

	// Parent no longer needs the write ends (child inherited them).
	stdoutW.Close()
	stderrW.Close()
	nul.Close()
	if err != nil {
		stdoutR.Close()
		stderrR.Close()
		return nil, fmt.Errorf("create process: %w", err)
	}
	defer windows.CloseHandle(pi.Process)

	if err := windows.AssignProcessToJobObject(job, pi.Process); err != nil {
		// Assignment should succeed; if it somehow fails, kill it rather than risk an orphan.
		windows.TerminateProcess(pi.Process, 127)
	}
	windows.ResumeThread(pi.Thread)
	windows.CloseHandle(pi.Thread)

	// Drain the pipes concurrently to avoid blocking on a full pipe buffer.
	var wg sync.WaitGroup
	var outBuf, errBuf bytes.Buffer
	wg.Add(2)
	go func() { defer wg.Done(); io.Copy(&outBuf, stdoutR) }()
	go func() { defer wg.Done(); io.Copy(&errBuf, stderrR) }()

	_, _ = windows.WaitForSingleObject(pi.Process, windows.INFINITE)

	var code uint32
	windows.GetExitCodeProcess(pi.Process, &code)

	stdoutR.Close()
	stderrR.Close()
	wg.Wait()

	combined := append(outBuf.Bytes(), errBuf.Bytes()...)
	if code != 0 {
		return combined, fmt.Errorf("exit code %d", code)
	}
	return combined, nil
}