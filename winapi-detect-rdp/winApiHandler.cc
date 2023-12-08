#include <napi.h>
#include <windows.h>
#include <tchar.h>
#include <iostream>
#include <wtsapi32.h>
#include <string>
#define TERMINAL_SERVER_KEY _T("SYSTEM\\CurrentControlSet\\Control\\Terminal Server\\")
#define GLASS_SESSION_ID    _T("GlassSessionId")



BOOL
IsCurrentSessionRemoteable()
{
    BOOL fIsRemoteable = FALSE;
                                       
    if (GetSystemMetrics(SM_REMOTESESSION)) 
    {
        fIsRemoteable = TRUE;
    }
    else
    {
        HKEY hRegKey = NULL;
        LONG lResult;

        lResult = RegOpenKeyEx(
            HKEY_LOCAL_MACHINE,
            TERMINAL_SERVER_KEY,
            0,
            KEY_READ,
            &hRegKey
            );

        if (lResult == ERROR_SUCCESS)
        {
            DWORD dwGlassSessionId;
            DWORD cbGlassSessionId = sizeof(dwGlassSessionId);
            DWORD dwType;

            lResult = RegQueryValueEx(
                hRegKey,
                GLASS_SESSION_ID,
                NULL,
                &dwType,
                (BYTE*) &dwGlassSessionId,
                &cbGlassSessionId
                );


            if (lResult == ERROR_SUCCESS)
            {
                DWORD dwCurrentSessionId;

                if (ProcessIdToSessionId(GetCurrentProcessId(), &dwCurrentSessionId))
                {
                    fIsRemoteable = (dwCurrentSessionId != dwGlassSessionId);
                }
            }
        }

        if (hRegKey)
        {
            RegCloseKey(hRegKey);
        }
    }

    return fIsRemoteable;
}

//////////////////////////////////////////////////

std::string getActiveProcessesInfo()
{
    std::string info;
    
    PWTS_PROCESS_INFOA pProcessInfo = NULL;
    DWORD dwCount = 0;
    WTSEnumerateProcessesA(WTS_CURRENT_SERVER_HANDLE, 0, 1, &pProcessInfo, &dwCount);

    for(DWORD dwIndex = 0; dwIndex < dwCount; dwIndex++)
    {
        if (strcmp(pProcessInfo[dwIndex].pProcessName, "Hackolade.exe") == 0) {
            info += std::to_string(pProcessInfo[dwIndex].SessionId) + ":";
            info += std::to_string(pProcessInfo[dwIndex].ProcessId) + ",";
        }
    }
    ::WTSFreeMemory(pProcessInfo);

    return info;
}


//////////////////////////////////////////////////


std::string WTSGetString( HANDLE serverHandle, DWORD sessionid, WTS_INFO_CLASS command, wchar_t* commandStr) 
{
    std::string strData;
    DWORD bytesReturned = 0;
    LPTSTR pData = NULL;
    if (WTSQuerySessionInformation(serverHandle, sessionid, command, &pData, &bytesReturned))
    {
        if (wcscmp(commandStr, L"WTSClientAddress") == 0) {
            PWTS_CLIENT_ADDRESS pWTSCA = NULL;
            pWTSCA = (PWTS_CLIENT_ADDRESS)pData;
            strData += std::to_string(pWTSCA->Address[2]) + ".";
            strData += std::to_string(pWTSCA->Address[3]) + ".";
            strData += std::to_string(pWTSCA->Address[4]) + ".";
            strData += std::to_string(pWTSCA->Address[5]);
        }
        else
        {
            strData += pData;
        }  
    }
    
    WTSFreeMemory(pData);
    return strData;
}


std::string ExtractFromWTS( HANDLE serverHandle, DWORD sessionid ) 
{
    std::string clientAddress = WTSGetString(serverHandle, sessionid, WTSClientAddress, L"WTSClientAddress");
    std::string userName = WTSGetString(serverHandle, sessionid, WTSUserName, L"WTSUserName");
    std::string winStationName = WTSGetString(serverHandle, sessionid, WTSWinStationName, L"WTSWinStationName");
    std::string domainName = WTSGetString(serverHandle, sessionid, WTSDomainName, L"WTSDomainName");
    std::string clientName = WTSGetString(serverHandle, sessionid, WTSClientName, L"WTSClientName");
    
    return
        "clientAddress:" + clientAddress + ";"
        "userName:" + userName + ";"
        "winStationName:" + winStationName + ";"
        "domainName:" + domainName + ";"
        "clientName:" + clientName + ";";
}

std::string getActiveSessionInfo()
{
    std::string info;
                                       
    if (GetSystemMetrics(SM_REMOTESESSION)) 
    {
        PWTS_SESSION_INFOA ppSessionInfo = 0;
        DWORD pCount, dwPID = 0, sessId;

        if(!WTSEnumerateSessions(WTS_CURRENT_SERVER_HANDLE, 0, 1, &ppSessionInfo, &pCount))
        {
            return "";
        }

        dwPID = GetCurrentProcessId();
        ProcessIdToSessionId(dwPID, &sessId);

        for (unsigned int i=0; i<pCount; i++)
        {  
            if (ppSessionInfo[i].SessionId == sessId) {
                info += ExtractFromWTS(WTS_CURRENT_SERVER_HANDLE, ppSessionInfo[i].SessionId);
            }  
        }
    }
    
    return info;
}


Napi::Boolean SessionDetector(const Napi::CallbackInfo& info) {
  BOOL isRemotable = IsCurrentSessionRemoteable();
  Napi::Env env = info.Env();
  return Napi::Boolean::New(env, isRemotable);
}

Napi::String ProcessInfo(const Napi::CallbackInfo& info) {
  std::string activeProcessesInfo = getActiveProcessesInfo();
  Napi::Env env = info.Env();
  return Napi::String::New(env, activeProcessesInfo);
}

Napi::String ActiveSessionInfo(const Napi::CallbackInfo& info) {
  std::string activeSessionInfo = getActiveSessionInfo();
  Napi::Env env = info.Env();
  return Napi::String::New(env, activeSessionInfo);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "isCurrentSessionRemoteable"),
              Napi::Function::New(env, SessionDetector));
  exports.Set(Napi::String::New(env, "getActiveProcessesInfo"),
              Napi::Function::New(env, ProcessInfo));
  exports.Set(Napi::String::New(env, "getActiveSessionInfo"),
              Napi::Function::New(env, ActiveSessionInfo));
  return exports;
}

NODE_API_MODULE(winApiHandler, Init)