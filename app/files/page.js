import MediaLibrary from '../components/media-library';

export const metadata = {
  title: 'My Files',
  description: 'Privately organize images and PDFs in OgeNotes.',
};

export default function FilesPage() {
  return <main className="shell media-library-shell"><MediaLibrary /></main>;
}
