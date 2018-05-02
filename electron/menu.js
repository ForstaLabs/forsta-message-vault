const {app, shell, Menu} = require('electron')


const template = [{
  label: 'Edit',
  submenu: [
    {
      role: 'undo'
    },
    {
      role: 'redo'
    },
    {
      type: 'separator'
    },
    {
      role: 'cut'
    },
    {
      role: 'copy'
    },
    {
      role: 'paste'
    },
    {
      role: 'pasteandmatchstyle'
    },
    {
      role: 'delete'
    },
    {
      role: 'selectall'
    }
  ]
},
{
  label: 'View',
  submenu: [
    {
      role: 'reload'
    },
    {
      role: 'forcereload'
    },
    {
      role: 'toggledevtools'
    },
    {
      type: 'separator'
    },
    {
      role: 'resetzoom'
    },
    {
      role: 'zoomin'
    },
    {
      role: 'zoomout'
    },
    {
      type: 'separator'
    },
    {
      role: 'togglefullscreen'
    }
  ]
},
{
  role: 'window',
  submenu: [
    {
      role: 'minimize'
    },
    {
      role: 'close'
    }
  ]
},
{
  role: 'help',
  submenu: [
    {
      label: 'Learn More',
      click () {
        shell.openExternal('https://forsta.io')
      }
    },
    {
      label: 'Search Issues',
      click () {
        shell.openExternal('https://github.com/ForstaLabs/message-vault/issues')
      }
    }
  ]
}];

if (process.platform === 'darwin') {
    template.unshift({
      label: 'Forsta Message Vault',
      submenu: [
        {
          role: 'about'
        },
        {
          type: 'separator'
        },
        {
          role: 'services',
          submenu: []
        },
        {
          type: 'separator'
        },
        {
          role: 'hide'
        },
        {
          role: 'hideothers'
        },
        {
          role: 'unhide'
        },
        {
          type: 'separator'
        },
        {
          role: 'quit'
        }
      ]
    })
    template[1].submenu.push({
      type: 'separator'
    }, {
      label: 'Speech',
      submenu: [
        {
          role: 'startspeaking'
        },
        {
          role: 'stopspeaking'
        }
      ]
    })
    template[3].submenu = [
      {
        role: 'close'
      },
      {
        role: 'minimize'
      },
      {
        role: 'zoom'
      },
      {
        type: 'separator'
      },
      {
        role: 'front'
      }
    ]
} else {
    template.unshift({
      label: 'File',
      submenu: [{
        role: 'quit'
      }]
    })
}

module.exports = Menu.buildFromTemplate(template)
