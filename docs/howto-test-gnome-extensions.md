# **Instructions: Running GNOME Shell in a Window for Extension Development**

This guide explains how to run a nested GNOME Shell session inside a window on your existing desktop. This method is invaluable for extension developers as it allows you to test changes instantly without needing to restart your main Wayland or X11 session, which would typically require a full logout and login.

### **Why Use a Nested Session?**

* **Speed:** Reloading a nested shell is nearly instantaneous, compared to the minutes it can take to log out and back in.  
* **Safety:** It creates a sandboxed environment. If your extension crashes the shell, it only closes the nested window, leaving your main desktop session unaffected.  
* **Convenience:** You can have your code editor open in your main session while the test environment runs in a separate window right next to it.

### **Step 1: The Magic Command**

The most reliable way to launch a nested session is to use dbus-run-session. This command correctly sets up a temporary D-Bus session, which is crucial for the shell and its components to communicate properly.

Open a terminal and run the following command:

dbus-run-session \-- gnome-shell \--nested \--wayland

### **What to Expect**

After running the command, a new window will appear. Inside this window, a completely fresh GNOME Shell session will boot up. You will see:

* The default GNOME wallpaper.  
* A standard top bar with the Activities button, clock, and system menu.  
* This session is fully interactive but isolated from your main session.

### **Step 2: Testing Your Extension Changes**

The nested session loads extensions from the same standard directories as your main session (\~/.local/share/gnome-shell/extensions and /usr/share/gnome-shell/extensions).

Here is the development workflow:

1. **Make Code Changes:** Edit your extension's source code in your preferred text editor as you normally would. Save the files.  
2. **Focus the Nested Window:** Click inside the nested GNOME Shell window to ensure it has keyboard focus.  
3. **Restart the Nested Shell:** Press Alt \+ F2. A command dialog will appear *inside the nested window*.  
4. **Enter 'r':** Type the letter r into the dialog and press Enter.

The nested GNOME Shell will quickly restart, applying your code changes. You can repeat this process as many times as you need, allowing for rapid iteration and testing.

### **Step 3: Viewing Logs and Debugging**

Errors and logs from your extension within the nested session will be printed directly to the terminal where you launched the dbus-run-session command. Keep this terminal visible to monitor for any log() statements from your extension or to catch errors as they happen.

### **Step 4: Closing the Nested Session**

When you are finished testing, you can close the nested session in one of two ways:

* **Close the Window:** Simply close the window like any other application.  
* **Stop the Command:** Go back to the terminal and press Ctrl \+ C to terminate the process.

### **Troubleshooting and Notes**

* **Performance:** The nested session may feel slightly less responsive than your main desktop, which is normal.  
* **Mouse Pointer Issues:** Occasionally, the mouse pointer might not render correctly or might seem to be offset. This is a known issue with nested environments.  
* **If the Command Fails:** Ensure you have the necessary packages installed, typically gnome-shell and mutter. The exact package names may vary by distribution. If you encounter D-Bus errors, double-check that you are using dbus-run-session.