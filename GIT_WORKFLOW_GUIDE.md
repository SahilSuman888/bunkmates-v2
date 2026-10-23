# Bunkmates Git Workflow Guide

A step-by-step reference guide for managing, committing, and pushing code changes to GitHub for the **Bunkmates** project.

---

## 1. Project Setup & Navigation

Always ensure your terminal is running inside the project folder:

```powershell
cd "c:\For Extra Chize\Projects\Working Project\Bunkmates\bunkmates-v2"
```

Verify your remote connection:
```powershell
git remote -v
# Output should point to: https://github.com/SahilSuman888/bunkmates-v2.git
```

---

## 2. Inspecting Your Changes

Before touching any commits, always check what files have been modified, deleted, or created:

```powershell
git status
```

### Review Differences:
- **Summary of files changed and lines touched:**
  ```powershell
  git diff --stat
  ```
- **Line-by-line inspection of all changes:**
  ```powershell
  git diff
  ```
- **Line-by-line inspection of a single file:**
  ```powershell
  git diff src/app/ProfileEdit.tsx
  ```

---

## 3. Staging Your Changes (`git add`)

Staging tells Git which modifications will be bundled into your next commit.

- **Option A: Stage specific files (Recommended):**
  ```powershell
  git add src/app/ProfileEdit.tsx src/app/ProfileSettings.tsx
  ```
- **Option B: Stage all modified and new files:**
  ```powershell
  git add .
  ```

Check status to confirm staged files appear in green under `"Changes to be committed"`:
```powershell
git status
```

---

## 4. Committing Your Changes (`git commit`)

Use clear and semantic commit messages following standard conventions:
- `feat(...)` for new features or UI additions
- `fix(...)` for bug fixes
- `refactor(...)` for restructuring code without changing functionality
- `style(...)` for visual tweaks, formatting, colors

### Example:
```powershell
git commit -m "feat(profile): update Edit Profile UI with greyish-white accents and cohesive navigation styling"
```

---

## 5. Pushing to GitHub (`git push`)

Send your local commits to the remote repository on GitHub:

- **Standard Push (if branch already tracks upstream):**
  ```powershell
  git push
  ```
- **First Push of a Branch (sets upstream tracking):**
  ```powershell
  git push -u origin feature/edit-profile-ui
  ```

---

## 6. Branch Management Workflow

### Creating a New Feature Branch
```powershell
git checkout -b feature/your-feature-name
# or with modern git:
git switch -c feature/your-feature-name
```

### Switching Between Existing Branches
```powershell
git checkout main
# or:
git switch main
```

### Pulling Latest Updates From Remote
```powershell
git pull origin feature/edit-profile-ui
```

---

## 7. Undo & Recovery Cheat Sheet

| Action | Command |
| :--- | :--- |
| **Discard unstaged changes in a file** | `git restore <file_path>` |
| **Unstage a file without losing code** | `git restore --staged <file_path>` |
| **Temporarily stash uncommitted work** | `git stash` |
| **Restore stashed work** | `git stash pop` |
| **View recent commits** | `git log -n 5 --oneline` |
| **See current branch name only** | `git branch --show-current` |
