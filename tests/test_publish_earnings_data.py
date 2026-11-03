from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from publish_earnings_data import publish

class PublicationRaceTests(unittest.TestCase):
    def test_concurrent_main_updates_are_preserved_or_automatically_requeued(self):
        for conflict in [False,True]:
            with self.subTest(conflict=conflict),tempfile.TemporaryDirectory()as directory:
                root=Path(directory)
                def git(path,*args):return subprocess.run(['git',*args],cwd=path,check=True,capture_output=True,text=True).stdout
                git(root,'init','--bare','remote.git')
                git(root,'clone',str(root/'remote.git'),'first');first=root/'first'
                git(first,'config','user.email','test@example.org');git(first,'config','user.name','Test')
                git(first,'checkout','-b','main');(first/'data.json').write_text('original\n');git(first,'add','.');git(first,'commit','-m','initial');git(first,'push','origin','main')
                git(root,'clone','-b','main',str(root/'remote.git'),'second');second=root/'second'
                git(second,'config','user.email','test@example.org');git(second,'config','user.name','Test')
                (first/'data.json').write_text('generated\n');git(first,'add','.');git(first,'commit','-m','generated')
                (second/('data.json'if conflict else'new-code.py')).write_text('remote change\n');git(second,'add','.');git(second,'commit','-m','concurrent main');git(second,'push','origin','main')
                queued=[];result=publish(first,'main',lambda:queued.append(True))
                if conflict:self.assertEqual((result,queued),('requeued',[True]))
                else:
                    self.assertEqual((result,queued),('published',[]));git(second,'pull','--ff-only')
                    self.assertEqual((second/'data.json').read_text(),'generated\n')
                    self.assertEqual((second/'new-code.py').read_text(),'remote change\n')

if __name__=='__main__':unittest.main()
