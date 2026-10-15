# Linux and DevOps Notes

Each section has a heading, answer, and saved time. Sections added from the dashboard are written to this file.

## 1. What is GRUB?
**Saved:** Imported from original notes

GRUB means **GRand Unified Bootloader**. It is a bootloader commonly used by Linux systems to select and start an operating system.

## 2. What is the relationship between an application, shell, kernel, and hardware?
**Saved:** Imported from original notes

Applications request services through the operating system. A shell is an interface for running commands; it uses the kernel to interact with hardware. The shell is one kind of application, so this is a simplified view rather than a strict sequence: **application or shell → kernel → hardware**.

## 3. How are Linux and Unix related?
**Saved:** Imported from original notes

Linux is a Unix-like, open-source operating system kernel. Unix refers to a family of operating systems and standards; some Unix systems are commercial and some are open source. Windows is not Unix.

## 4. What does `top` show?
**Saved:** Imported from original notes

`top` displays running processes and live system resource usage, including CPU and memory. Processes can be running, stopped, or terminated. A zombie is a process that has exited but still has an entry awaiting collection by its parent.

## 5. What does EC2 mean?
**Saved:** Imported from original notes

EC2 stands for **Amazon Elastic Compute Cloud**. It provides virtual servers (instances) in AWS.

## 6. What does `wc` do?
**Saved:** Imported from original notes

`wc file.txt` reports line, word, and byte counts. Use `wc -l`, `wc -w`, or `wc -c` to request a specific count.

## 7. What are hard links and symbolic links?
**Saved:** Imported from original notes

A hard link is another directory entry for the same file data. Removing one name does not remove the data while another hard link remains. Create one with `ln path/file.txt hardlink-file`.

A symbolic (soft) link stores a path to another file. It can become broken if the target is removed or moved. Create one with `ln -s path/file.txt softlink-file`.

## 8. What does `ls -ltr` do?
**Saved:** Imported from original notes

`ls -ltr` lists entries in long format, sorted by modification time with the oldest first. Add `-a` to include hidden entries: `ls -altr`.

## 9. How does `cut` select parts of a file?
**Saved:** Imported from original notes

`cut -b 1 file.txt` prints the first byte of each line. `cut -b 1-4 file.txt` prints bytes 1 through 4. For characters in multibyte text, use `cut -c` instead.

## 10. What does `tee` do?
**Saved:** Imported from original notes

`tee` copies standard input to both the terminal and a file. For example, `echo "hello" | tee file.txt` displays and writes `hello`. Use `tee -a file.txt` to append.

## 11. What does `>` do in the shell?
**Saved:** Imported from original notes

`>` redirects command output to a file, replacing its contents if it already exists. For example, `echo "this is a new file" > file.txt`. Use `>>` to append instead.

## 12. What do `sort` and `diff` do?
**Saved:** Imported from original notes

`sort file.txt` prints the lines in sorted order. `diff file1.txt file2.txt` compares two files and shows their differences.

## 13. How do I use `vi` to edit a file?
**Saved:** Imported from original notes

Open a file with `vi file.txt`. Press `i` to enter insert mode, edit the text, then press `Esc`. Type `:wq` and press Enter to save and quit.

## 14. What are common disk and directory commands?
**Saved:** Imported from original notes

- `df -h` shows filesystem space in a human-readable format.
- `du .` estimates space used by the current directory and its contents.
- `ls -a` includes hidden entries.

## 15. How can I inspect and manage processes?
**Saved:** Imported from original notes

- `top` shows a live process overview.
- `ps` lists processes; `ps aux` is a common system-wide view.
- `fuser PATH` shows processes using a file or filesystem (for example, a mounted network share).
- `kill PID` asks a process to stop; `kill -9 PID` forces termination and should be a last resort.

## 16. How can I check memory and run a command that survives logout?
**Saved:** Imported from original notes

`free -h` summarizes memory usage in human-readable units. `nohup command > output.log 2>&1 &` runs a command so it can continue after logout and writes its output to a log file.

## 17. What do `head` and `tail` do?
**Saved:** Imported from original notes

`head -n 5 file.txt` shows the first five lines. `tail -n 5 file.txt` shows the last five lines. `tail -f file.txt` follows new lines as they are written.

## 18. What does `vmstat` show?
**Saved:** Imported from original notes

`vmstat` reports system process, memory, swap, I/O, and CPU statistics. `vmstat -a` includes active and inactive memory figures. Add an interval such as `vmstat 1` to refresh repeatedly.

## 19. Which commands show system identity, time, and users?
**Saved:** Imported from original notes

- `uname` shows system information; `uname -a` prints more details.
- `uptime` shows how long the system has been running and its load averages.
- `date` displays the current date and time.
- `who` lists logged-in users; `whoami` prints the current username.

## 20. What does `which` do?
**Saved:** Imported from original notes

`which bash` prints the path of the `bash` executable found through `PATH`. For example, it may return `/usr/bin/bash`.
