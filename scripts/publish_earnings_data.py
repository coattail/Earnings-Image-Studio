"""Publish generated data without overwriting a newer main branch."""
import argparse
import os
from pathlib import Path
import subprocess

def publish(repo,branch,redispatch,attempts=3):
    def git(*args):
        return subprocess.run(['git',*args],cwd=repo,capture_output=True,text=True)
    for _ in range(attempts):
        pushed=git('push','origin',f'HEAD:{branch}')
        if pushed.returncode==0:return 'published'
        fetched=git('fetch','origin',branch)
        if fetched.returncode:
            raise RuntimeError(fetched.stderr)
        if git('merge-base','--is-ancestor','FETCH_HEAD','HEAD').returncode==0:
            # Main did not advance: authentication/network failures are not a
            # publication race and must not create an immediate dispatch loop.
            raise RuntimeError(pushed.stderr)
        rebased=git('rebase','FETCH_HEAD')
        if rebased.returncode:
            git('rebase','--abort')
            redispatch()
            return 'requeued'
    redispatch()
    return 'requeued'

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--workflow',default='update-data.yml')
    parser.add_argument('--deploy-workflow',default='deploy-pages.yml')
    args=parser.parse_args()
    branch=os.environ.get('GITHUB_REF_NAME','main')
    def redispatch():
        command=['gh','workflow','run',args.workflow,'--ref',branch]
        if args.workflow=='update-data.yml':
            command+=['-f','mode='+os.environ.get('MODE_INPUT','detect-and-refresh'),'-f','companies='+os.environ.get('COMPANIES_INPUT','')]
        subprocess.run(command,check=True)
        print('::notice::Branch changed during update; a fresh cloud update has been queued automatically.')
    result=publish(Path.cwd(),branch,redispatch)
    if result=='published':subprocess.run(['gh','workflow','run',args.deploy_workflow,'--ref',branch],check=True)
    print('Earnings data publication:',result)

if __name__=='__main__':main()
