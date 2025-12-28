package main

import (
	"fmt"
	"os"
)

const managerVersion = "0.1.0"

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	cmd := os.Args[1]
	args := os.Args[2:]

	switch cmd {
	case "install":
		runInstall(args)
	case "update":
		runUpdate(args)
	case "start":
		runStart(args)
	case "stop":
		runStop(args)
	case "restart":
		runRestart(args)
	case "status":
		runStatus(args)
	case "logs":
		runLogs(args)
	case "oauth":
		runOAuth(args)
	case "gui":
		runGUI(args)
	case "uninstall":
		runUninstall(args)
	case "help", "-h", "--help":
		printUsage()
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", cmd)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("betaCLIProxyAPI - Go-based manager for CLIProxyAPIPlus")
	fmt.Println("")
	fmt.Println("Usage:")
	fmt.Println("  betacliproxyapi <command> [options]")
	fmt.Println("")
	fmt.Println("Commands:")
	fmt.Println("  install     Install CLIProxyAPIPlus and create config")
	fmt.Println("  update      Update CLIProxyAPIPlus binary")
	fmt.Println("  start       Start CLIProxyAPIPlus server")
	fmt.Println("  stop        Stop CLIProxyAPIPlus server")
	fmt.Println("  restart     Restart CLIProxyAPIPlus server")
	fmt.Println("  status      Show server status")
	fmt.Println("  logs        Show server logs")
	fmt.Println("  oauth       Run OAuth login helper")
	fmt.Println("  gui         Start Control Center GUI")
	fmt.Println("  uninstall   Remove CLIProxyAPIPlus files")
	fmt.Println("")
	fmt.Println("Run 'betacliproxyapi <command> -h' for command options.")
}
