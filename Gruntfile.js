// vim: et sw=2 ts=2
/* global module, require */

const fs = require('fs');
const path = require('path');


function assert_exists(file) {
    if (!fs.existsSync(file)) {
        throw new Error(`File not found: ${file}`);
    }
    return file;
}

function add_prefix(left, right) {
    return assert_exists(path.join(left, right));
}


module.exports = function(grunt) {
  'use strict';

  const dist = 'dist';
  const static_dist = `${dist}/static`;

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-sass');
  try {
    grunt.loadNpmTasks('grunt-contrib-watch');
  } catch(e) {
    console.warn("Grunt 'watch' is not available");
  }

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    concat: {
      app_deps: {
        src: [
          "jquery/dist/jquery.js",
        ].map(x => add_prefix('node_modules', x)),
        dest: `${static_dist}/js/deps.js`
      },

      app_main: {
        src: [
          'main.js'
        ].map(x => add_prefix('app', x)),
        dest: `${static_dist}/js/main.js`
      },

      app_install: {
        src: [
          'install.js'
        ].map(x => add_prefix('app', x)),
        dest: `${static_dist}/js/install.js`
      },
    },

    sass: {
      stylesheets: {
        options: {
            sourcemap: 'inline'
        },
        files: [{
          expand: true,
          cwd: 'stylesheets',
          src: ['*.scss'],
          dest: `${static_dist}/stylesheets`,
          ext: '.css'
        }]
      }
    },

    copy: {
      static: {
        nonull: true,
        files: [{
          expand: true,
          src: [
            'html/**',
            'images/**',
          ],
          dest: static_dist
        }]
      },

      semantic: {
        nonull: true,
        files: [{
          expand: true,
          cwd: 'semantic/dist',
          src: ['**'],
          dest: `${static_dist}/semantic`
        }]
      }
    },

    watch: {
      stylesheets: {
        files: [
          'stylesheets/*.scss',
        ],
        tasks: ['sass']
      },
      code: {
        files: [
          'app/**',
          'Gruntfile.js'
        ],
        tasks: ['concat', 'copy']
      },
      html: {
        files: [
          'images/**',
          'html/**'
        ],
        tasks: ['copy']
      }
    }
  });

  grunt.registerTask('default', ['concat', 'sass', 'copy']);
};
