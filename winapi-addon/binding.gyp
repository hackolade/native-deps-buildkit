{
  "targets": [
    {
      "target_name": "winApiHandler",
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "sources": [ "winApiHandler.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      'defines': [ 'NAPI_DISABLE_CPP_EXCEPTIONS' ],
      "link_settings": {
          "libraries": [
            "user32.lib",
            "wtsapi32.lib",
            "Advapi32.lib"
          ]            
      }
    }
  ]
}
