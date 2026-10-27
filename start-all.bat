@echo off
start "SkillSwap server" cmd /k "cd /d %~dp0server && npm start"
start "SkillSwap app" cmd /k "cd /d %~dp0 && npx expo start"