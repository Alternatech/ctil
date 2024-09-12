/* groovylint-disable NestedBlockDepth, NoDef, UnusedVariable, VariableName, VariableTypeRequired */
@Library('do64013-shared-libraries') _
pipeline {
  agent { label 'pttdevops-slave' }
  environment {
    PROJECT_KEY = 'common-utilities'
  }
  stages {
    stage('Run Tests') {
      stages {
        stage('Setup') {
          steps {
            setEnvironmentVariables()
          }
        }
        stage('Publish') {
            steps {
                nodeBuildLibrary([PROJECT_KEY: "${PROJECT_KEY}"])
                publishLibrary()
            }
        }
      }
    }
  }
}
